use std::io::ErrorKind;
use std::net::TcpListener;
use std::sync::Mutex;
use tiny_http::Server;

pub const PREFERRED_PORT: u16 = 8743;

pub struct AttentionServer {
    port: Mutex<Option<u16>>,
}

impl AttentionServer {
    pub const fn new() -> Self {
        Self { port: Mutex::new(None) }
    }

    pub fn start(&self, preferred_port: u16, start: impl FnOnce(Server) -> Result<(), String>) -> Result<u16, String> {
        let mut active = self.port.lock().map_err(|e| e.to_string())?;
        if let Some(port) = *active {
            return Ok(port);
        }
        let listener = TcpListener::bind(("127.0.0.1", preferred_port))
            .or_else(|error| match error.kind() {
                ErrorKind::AddrInUse | ErrorKind::PermissionDenied => TcpListener::bind(("127.0.0.1", 0)),
                _ => Err(error),
            })
            .map_err(|e| format!("Lokaler Briefing-Endpunkt konnte nicht gestartet werden: {e}"))?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let server = Server::from_listener(listener, None).map_err(|e| e.to_string())?;
        start(server)?;
        *active = Some(port);
        Ok(port)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::sync::{Arc, Barrier};
    use std::time::Duration;
    use tiny_http::Response;

    #[test]
    fn keeps_available_preferred_port_and_reuses_server() {
        let reservation = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let preferred_port = reservation.local_addr().unwrap().port();
        drop(reservation);
        let state = AttentionServer::new();
        let mut server = None;
        let port = state
            .start(preferred_port, |started| {
                server = Some(started);
                Ok(())
            })
            .unwrap();
        assert_eq!(port, preferred_port);
        assert_eq!(server.as_ref().unwrap().server_addr().to_ip().unwrap().port(), port);
        assert_eq!(
            state.start(preferred_port, |_| panic!("server started twice")).unwrap(),
            port
        );
    }

    #[test]
    fn occupied_port_falls_back_to_reachable_loopback_server() {
        let occupied = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let preferred_port = occupied.local_addr().unwrap().port();
        let state = AttentionServer::new();
        let mut server = None;
        let port = state
            .start(preferred_port, |started| {
                server = Some(started);
                Ok(())
            })
            .unwrap();
        assert_ne!(port, preferred_port);
        assert_ne!(port, 0);
        let server = server.unwrap();
        assert_eq!(
            server.server_addr().to_ip().unwrap().ip(),
            std::net::Ipv4Addr::LOCALHOST
        );
        let worker = std::thread::spawn(move || {
            let request = server.recv_timeout(Duration::from_secs(5)).unwrap().unwrap();
            assert_eq!(request.url(), "/attention");
            request.respond(Response::from_string("ready")).unwrap();
        });
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        stream
            .write_all(b"POST /attention HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        assert!(response.starts_with("HTTP/1.1 200"));
        assert!(response.ends_with("ready"));
        worker.join().unwrap();
        assert_eq!(occupied.local_addr().unwrap().port(), preferred_port);
    }

    #[test]
    fn concurrent_starts_share_one_fallback_port() {
        let occupied = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let preferred_port = occupied.local_addr().unwrap().port();
        let state = Arc::new(AttentionServer::new());
        let barrier = Arc::new(Barrier::new(8));
        let servers = Arc::new(Mutex::new(Vec::new()));
        let workers: Vec<_> = (0..8)
            .map(|_| {
                let state = state.clone();
                let barrier = barrier.clone();
                let servers = servers.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    state
                        .start(preferred_port, |server| {
                            servers.lock().unwrap().push(server);
                            Ok(())
                        })
                        .unwrap()
                })
            })
            .collect();
        let ports: Vec<_> = workers.into_iter().map(|worker| worker.join().unwrap()).collect();
        assert!(ports.iter().all(|port| *port == ports[0] && *port != preferred_port));
        assert_eq!(servers.lock().unwrap().len(), 1);
    }

    #[test]
    fn failed_start_can_be_retried() {
        let state = AttentionServer::new();
        assert_eq!(
            state.start(0, |_| Err("start failed".to_string())),
            Err("start failed".to_string())
        );
        let mut server = None;
        let port = state
            .start(0, |started| {
                server = Some(started);
                Ok(())
            })
            .unwrap();
        assert_ne!(port, 0);
        assert!(server.is_some());
    }
}
