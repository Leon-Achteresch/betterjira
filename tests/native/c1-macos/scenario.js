async (remoteSource) => {
  const remote = JSON.parse(remoteSource);
  const revised = structuredClone(remote);
  revised.content.find((node) => node.type === "extension").attrs.revision = "R2";
  const draftId = JSON.stringify(["qa-cloud", "qa-user", "DEMO-1", "description#adf"]);
  const comparison = () => document.querySelector('[role="group"][aria-labelledby="description-comparison-title"]');
  const editor = () => document.querySelector('[role="textbox"][aria-label="Beschreibung"]');
  const button = (text, root = document) => [...(root?.querySelectorAll("button") ?? [])].find(
    (entry) => entry.getClientRects().length && (entry.getAttribute("aria-label") ?? entry.textContent.trim()) === text,
  );
  const draft = () => JSON.parse(localStorage.getItem("betterjira-field-drafts")).state.drafts[draftId];
  const writes = () => window.__qa.writes;
  const check = (condition, detail) => { if (!condition) throw new Error(detail); };
  const canonical = (value) => JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
      : item,
  );
  const equal = (actual, expected, detail) => check(canonical(actual) === canonical(expected), detail);
  const wait = async (observe, detail) => {
    const deadline = performance.now() + 12_000;
    while (performance.now() < deadline) {
      const found = observe();
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const errors = window.c1Errors?.slice(-8) ?? [];
    const reads = window.__qa?.issueReads?.slice(-8) ?? [];
    const active = document.activeElement?.outerHTML.split(">")[0].slice(0, 180);
    const visibility = document.visibilityState;
    throw new Error(`Timed out: ${detail} at ${location.pathname}. ${JSON.stringify({ active, errors, reads, visibility })}`);
  };
  const click = async (observe, detail) => {
    const target = await wait(observe, detail);
    check(!target.disabled && target.getAttribute("aria-disabled") !== "true", `${detail} is disabled`);
    target.click();
  };
  const append = async (text) => {
    const field = await wait(() => editor() === document.activeElement && editor(), "focused description editor");
    getSelection().collapse(field.lastElementChild, field.lastElementChild.childNodes.length);
    check(document.execCommand("insertText", false, text), "WebKit rejected text input");
    await wait(() => field.textContent.includes(text), text);
  };
  const save = () => click(() => button("Speichern"), "save description");
  const setRemote = (value) => {
    window.__qa.issues.find((issue) => issue.key === "DEMO-1").fields.description = value;
  };
  const follow = (key) => click(() => [...document.querySelectorAll(`section a[href="/issue/${key}"]`)]
    .find((link) => link.getClientRects().length), `linked issue ${key}`);
  const showSource = async () => {
    const preview = await wait(() => button("Vorschau", comparison()), "comparison preview tab");
    preview.focus();
    preview.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    await wait(() => button("Quelle", comparison())?.getAttribute("aria-selected") === "true", "comparison source tab");
    return wait(() => comparison()?.querySelector('pre[aria-label="Aktuell in Jira"]'), "remote source");
  };

  await click(() => button("Beschreibung bearbeiten"), "regular description editor entry");
  await append(" Lokaler Zusatz");
  setRemote(remote);
  await save();
  const current = await wait(() => comparison()?.querySelector('[role="region"][aria-label="Aktuell in Jira"]'), "conflict preview");
  await wait(() => document.activeElement === comparison()?.querySelector("h3"), "focus on comparison heading");
  for (const text of ["Lesbarer Text innerhalb der Erweiterung", "Text im verschachtelten Hinweis", "danach lesbar."]) {
    check(current.textContent.includes(text), `Missing nested text: ${text}`);
  }
  check(current.textContent.split("Nur in der Quelle darstellbar").length === 4, "Unknown ADF nodes lack placeholders");
  for (const id of ["46883", "46886"]) {
    await wait(() => current.querySelector(`[data-attachment-id="${id}"]`), `resolved synthetic media ${id}`);
  }
  for (const name of ["Einzelmedium.bin", "Ablauf Übergabe.png", "Externes Gruppenbild", "Externes Einzelbild"]) {
    check([...current.querySelectorAll('[data-adf-media="missing"]')].some((item) => item.textContent.includes(name)),
      `Missing unresolved media label: ${name}`);
  }
  equal(JSON.parse((await showSource()).textContent), remote, "Remote raw ADF changed");
  equal(writes(), [], "Comparison sent a write");

  await click(() => button("In Entwurf übernehmen", comparison()), "adopt remote into draft");
  await wait(() => !comparison() && document.activeElement === editor(), "editor focus after remote adoption");
  const adopted = draft();
  equal(JSON.parse(adopted.text), remote, "Adopted ADF changed");
  equal(adopted.basis.value, remote, "Adopted comparison basis changed");
  equal(writes(), [], "Local adoption sent a write");
  editor().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await wait(() => !editor(), "close editor with Escape");
  equal(draft(), adopted, "Escape changed the adopted draft");
  equal(writes(), [], "Escape sent a write");

  await click(() => button("Beschreibung: Entwurf fortsetzen"), "resume draft");
  await append(" ergänzt");
  setRemote(revised);
  let releaseRead;
  window.__qaDescriptionReadGate = (key) => {
    check(key === "DEMO-1", "Unexpected description GET while switching issues");
    return new Promise((resolve) => { releaseRead = resolve; });
  };
  await save();
  await wait(() => releaseRead, "held fresh description GET");
  await follow("DEMO-2");
  await wait(() => location.pathname === "/issue/DEMO-2" && !editor() && button("Beschreibung bearbeiten"), "other issue ready");
  delete window.__qaDescriptionReadGate;
  releaseRead();
  await follow("DEMO-1");
  await wait(() => location.pathname === "/issue/DEMO-1", "return to issue");
  await click(() => button("Beschreibung: Entwurf fortsetzen"), "resume after context change");
  await wait(() => button("Speichern") && !button("Speichern").disabled, "held check settled");
  check(!comparison(), "Late reply opened a comparison in the resumed editor");
  equal(writes(), [], "Unconfirmed conflict after context change sent a write");

  await save();
  equal(JSON.parse((await showSource()).textContent), revised, "Recheck did not preserve the new remote ADF");
  const confirm = () => button("Entwurf trotzdem speichern", comparison());
  check(confirm()?.disabled, "Overwrite available before confirmation");
  equal(writes(), [], "Recheck sent a write");
  await click(() => comparison()?.querySelector('[role="checkbox"]'), "explicit conflict acknowledgement");
  await click(confirm, "confirm overwrite");
  await wait(() => !editor(), "confirmed edit finished");
  const expected = structuredClone(remote);
  expected.content.at(-1).content[0].text += " ergänzt";
  equal(writes(), [{ path: "/issue/DEMO-1", method: "PUT", input: { fields: { description: expected } } }],
    "Expected one exact synthetic description PUT");
  equal(window.__qa.issueReads.filter((path) => path.endsWith("?fields=description")),
    Array(4).fill("/issue/DEMO-1?fields=description"), "Expected four fresh description checks");
  check(!window.__qa.reads.includes("/group.png") && !window.__qa.reads.includes("/single.png"), "External media reached the Jira bridge");

  return "PASS C1 WKWebView: conflict before PUT, readable ADF/media and exact source, local adoption, Escape, delayed conflict after issue switch, one exact confirmed synthetic PUT.";
}
