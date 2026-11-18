import AppKit
import UniformTypeIdentifiers
import WebKit

struct TestFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

final class FixtureAssets: NSObject, WKURLSchemeHandler {
    static let origin = URL(string: "c1fixture://app/")!
    private static let policy = [
        "default-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:", "img-src 'self' data: blob:", "connect-src 'none'",
        "base-uri 'none'", "form-action 'none'",
    ].joined(separator: "; ")
    let directory: URL

    init(directory: URL) {
        self.directory = directory.resolvingSymlinksInPath()
    }

    static func serves(_ url: URL) -> Bool {
        url.scheme == origin.scheme && url.host == origin.host && url.port == nil
    }

    func webView(_ view: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url, Self.serves(url), task.request.httpMethod == "GET" else {
            task.didFailWithError(URLError(.unsupportedURL))
            return
        }
        if url.path == "/__preflight" {
            respond(task, url: url, data: Data("<!doctype html><body>C1 isolation preflight".utf8),
                    mime: "text/html", restricted: false)
            return
        }
        if url.path == "/__preflight.js" {
            respond(task, url: url, data: Data("window.c1FixtureReached = true".utf8),
                    mime: "text/javascript", restricted: false)
            return
        }
        let file = directory.appendingPathComponent(String(url.path.dropFirst())).resolvingSymlinksInPath()
        guard file.path.hasPrefix(directory.path + "/"), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        respond(task, url: url, data: data, mime: mime, restricted: true)
    }

    func webView(_ view: WKWebView, stop task: any WKURLSchemeTask) {}

    private func respond(_ task: any WKURLSchemeTask, url: URL, data: Data, mime: String, restricted: Bool) {
        var headers = ["Content-Type": mime, "Access-Control-Allow-Origin": "*", "X-DNS-Prefetch-Control": "off"]
        if restricted { headers["Content-Security-Policy"] = Self.policy }
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }
}

@MainActor
final class FixtureView: NSObject, WKNavigationDelegate {
    private let webView: WKWebView
    private var panel: NSPanel?
    private var navigation: CheckedContinuation<Void, Error>?

    init(directory: URL, rules: WKContentRuleList) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(rules)
        configuration.userContentController.addUserScript(WKUserScript(source: """
            window.c1Errors = []
            addEventListener("error", (event) => c1Errors.push(event.message ?? event.target.src ?? event.target.href), true)
            addEventListener("unhandledrejection", (event) => c1Errors.push(String(event.reason)))
            addEventListener("securitypolicyviolation", (event) => c1Errors.push(event.violatedDirective + " " + event.blockedURI))
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.setURLSchemeHandler(FixtureAssets(directory: directory), forURLScheme: FixtureAssets.origin.scheme!)
        precondition(!configuration.websiteDataStore.isPersistent)
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 900), configuration: configuration)
        super.init()
        webView.navigationDelegate = self
    }

    func present() {
        let window = NSPanel(contentRect: webView.frame, styleMask: [.titled, .nonactivatingPanel],
                             backing: .buffered, defer: false)
        window.title = "C1 WKWebView Fixture"
        window.contentView = webView
        window.center()
        window.orderFrontRegardless()
        panel = window
    }

    func load(_ path: String) async throws {
        let url = URL(string: path, relativeTo: FixtureAssets.origin)!.absoluteURL
        try await withCheckedThrowingContinuation { continuation in
            navigation = continuation
            webView.load(URLRequest(url: url))
        }
    }

    func webView(_ view: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard action.targetFrame?.isMainFrame == true,
              let url = action.request.url, FixtureAssets.serves(url) else { return .cancel }
        return .allow
    }

    func webView(_ view: WKWebView, didFinish _: WKNavigation!) {
        navigation?.resume()
        navigation = nil
    }

    func webView(_ view: WKWebView, didFail _: WKNavigation!, withError error: Error) {
        navigation?.resume(throwing: error)
        navigation = nil
    }

    func webView(_ view: WKWebView, didFailProvisionalNavigation _: WKNavigation!, withError error: Error) {
        webView(view, didFail: nil, withError: error)
    }

    func evaluate(_ body: String, arguments: [String: Any] = [:]) async throws -> Any? {
        try await webView.callAsyncJavaScript(body, arguments: arguments, in: nil, contentWorld: .page)
    }
}

@main
struct Acceptance {
    @MainActor
    static func main() {
        NSApplication.shared.setActivationPolicy(.accessory)
        Task { await run() }
        NSApplication.shared.run()
    }

    @MainActor
    static func run() async {
        do {
            let args = CommandLine.arguments
            let directory = URL(fileURLWithPath: args[1], isDirectory: true)
            guard let temp = ProcessInfo.processInfo.environment["TMPDIR"] else {
                throw TestFailure(message: "Private temporary directory unavailable")
            }
            let rulesJSON = """
            [
              {"trigger":{"url-filter":".*"},"action":{"type":"block"}},
              {"trigger":{"url-filter":"^c1fixture://app/"},"action":{"type":"ignore-previous-rules"}},
              {"trigger":{"url-filter":"^data:"},"action":{"type":"ignore-previous-rules"}},
              {"trigger":{"url-filter":"^blob:"},"action":{"type":"ignore-previous-rules"}}
            ]
            """
            guard let rules = try await WKContentRuleListStore(url: URL(fileURLWithPath: temp, isDirectory: true))
                .compileContentRuleList(forIdentifier: "c1-loopback", encodedContentRuleList: rulesJSON) else {
                throw TestFailure(message: "WebKit rules unavailable")
            }
            let fixture = FixtureView(directory: directory, rules: rules)
            try await fixture.load("/__preflight")
            let preflight = try await fixture.evaluate("""
                if (localStorage.length || sessionStorage.length || document.cookie)
                    throw new Error("Fixture origin has existing state")
                const scriptLoads = (url) => new Promise((resolve) => {
                    const script = document.createElement("script")
                    script.onload = () => resolve(true)
                    script.onerror = () => resolve(false)
                    script.src = url
                    document.body.append(script)
                })
                if (!await scriptLoads("/__preflight.js") || !window.c1FixtureReached ||
                    await scriptLoads(canary + "/webkit") || window.c1CanaryReached)
                    throw new Error("WebKit content rule did not isolate fixture loads")
                return navigator.userAgent
                """, arguments: ["canary": args[2]])
            let evidence = "WKWebView preflight: fresh nonpersistent storage, internal assets reachable and HTTP canary blocked. \(preflight ?? "")\n"
            FileHandle.standardOutput.write(Data(evidence.utf8))

            fixture.present()
            try await fixture.load("/tests/browser/fixture.html?scenario=adf-images&route=/issue/DEMO-1")
            let scenario = try String(contentsOfFile: args[3], encoding: .utf8)
            let adf = try String(contentsOfFile: args[4], encoding: .utf8)
            guard let result = try await fixture.evaluate("return await (\(scenario))(remoteSource)", arguments: ["remoteSource": adf]) as? String else {
                throw TestFailure(message: "Missing acceptance result")
            }
            print(result)
            exit(0)
        } catch {
            let failure = error as NSError
            let detail = failure.userInfo["WKJavaScriptExceptionMessage"] ?? failure
            FileHandle.standardError.write(Data("C1 WKWebView: \(detail)\n".utf8))
            exit(1)
        }
    }
}
