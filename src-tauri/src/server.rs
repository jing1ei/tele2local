//! App-managed local Telegram Bot API server.

use crate::config::ServerConfig;
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Stdio};
use std::time::{Duration, Instant};

/// How long to wait for a freshly spawned server to start accepting connections
/// before declaring it failed.
const READY_TIMEOUT: Duration = Duration::from_secs(10);

/// Install locations probed when no explicit binary path is configured.
/// Covers Homebrew on Apple Silicon and Intel plus the usual system prefixes.
#[cfg(target_os = "macos")]
const CANDIDATES: &[&str] = &[
    "/opt/homebrew/bin/telegram-bot-api",
    "/usr/local/bin/telegram-bot-api",
    "/usr/bin/telegram-bot-api",
];

/// Resolve the `telegram-bot-api` binary: an explicit configured path first,
/// then the common install locations, then a direct `PATH` lookup.
/// Returns `None` if nothing usable is found.
pub fn locate_binary(explicit: Option<&str>) -> Option<PathBuf> {
    if let Some(p) = explicit.map(str::trim).filter(|s| !s.is_empty()) {
        let pb = PathBuf::from(p);
        return pb.is_file().then_some(pb);
    }
    #[cfg(target_os = "macos")]
    for c in CANDIDATES {
        let pb = PathBuf::from(c);
        if pb.is_file() {
            return Some(pb);
        }
    }
    let executable = if cfg!(windows) {
        "telegram-bot-api.exe"
    } else {
        "telegram-bot-api"
    };
    if let Some(paths) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&paths) {
            if dir.as_os_str().is_empty() {
                continue;
            }
            let candidate = dir.join(executable);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// The origin a bot should talk to when the local server is running.
pub fn local_url(port: u16) -> String {
    format!("http://127.0.0.1:{}", port)
}

/// A running local Bot API server. Dropping the handle kills the child process
/// (and reaps it), so the server can't be left orphaned when the app exits or
/// the settings change.
pub struct ServerHandle {
    child: Child,
    /// The port this process is listening on. Bots are routed using *this*, not
    /// the configured port, so a config edit can never point them somewhere the
    /// running server isn't.
    pub port: u16,
}

impl ServerHandle {
    pub fn check_running(&mut self) -> Result<(), String> {
        match self.child.try_wait() {
            Ok(None) => Ok(()),
            Ok(Some(status)) => Err(format!(
                "local server exited ({status}); open Local server and save to restart"
            )),
            Err(e) => Err(format!("cannot check local server: {e}")),
        }
    }
}

impl Drop for ServerHandle {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// Spawn the local `telegram-bot-api` server in `--local` mode.
pub fn start(cfg: &ServerConfig, data_dir: &Path) -> Result<ServerHandle, String> {
    if cfg.api_id <= 0 || cfg.api_hash.trim().is_empty() {
        return Err("api_id and api_hash are required to run the local server".into());
    }
    let bin = locate_binary(cfg.bin_path.as_deref()).ok_or_else(|| {
        "telegram-bot-api not found — build it from source \
         (https://tdlib.github.io/telegram-bot-api/build.html) and set its path in server settings"
            .to_string()
    })?;

    let temp_dir = data_dir.join("temp");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let port = cfg.effective_port();
    match TcpListener::bind((Ipv4Addr::LOCALHOST, port)) {
        Ok(probe) => drop(probe),
        Err(e) => {
            return Err(format!(
                "port {port} is already in use ({e}) - stop whatever is listening on it, \
                 or choose another port in server settings"
            ))
        }
    }

    // Keep the server's own diagnostics: without them a refused connection or an
    // instant exit is indistinguishable from a wrong port, and there is nowhere
    // to look. Truncated each start so it can't grow without bound.
    let log_path = data_dir.join("server.log");
    let log = std::fs::File::create(&log_path).map_err(|e| {
        format!(
            "could not open the server log at {}: {}",
            log_path.display(),
            e
        )
    })?;
    let log_err = log
        .try_clone()
        .map_err(|e| format!("could not open the server log: {}", e))?;

    let mut child = crate::platform::background_command(&bin)
        .arg("--local")
        .arg("--http-ip-address=127.0.0.1")
        .arg(format!("--http-port={}", port))
        .arg(format!("--dir={}", data_dir.display()))
        .arg(format!("--temp-dir={}", temp_dir.display()))
        .env("TELEGRAM_API_ID", cfg.api_id.to_string())
        .env("TELEGRAM_API_HASH", cfg.api_hash.trim())
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err))
        .spawn()
        .map_err(|e| format!("could not start telegram-bot-api: {}", e))?;

    // Spawning only proves the binary was executable: `telegram-bot-api` exits
    // within milliseconds on bad credentials or an already-bound port. Wait for
    // the socket to actually accept before calling the server healthy.
    match wait_until_listening(&mut child, port) {
        Ok(()) => Ok(ServerHandle { child, port }),
        Err(e) => {
            let _ = child.kill();
            let _ = child.wait();
            Err(format!("{} (details in {})", e, log_path.display()))
        }
    }
}

/// Block until the server accepts a TCP connection on `port`, it exits, or
/// [`READY_TIMEOUT`] elapses.
fn wait_until_listening(child: &mut Child, port: u16) -> Result<(), String> {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let deadline = Instant::now() + READY_TIMEOUT;
    loop {
        // A server that has already exited will never listen; report why.
        match child.try_wait() {
            Ok(Some(status)) => {
                return Err(format!(
                    "telegram-bot-api exited immediately ({status}) — usually a wrong \
                     api_id/api_hash, or port {port} is already in use"
                ))
            }
            Ok(None) => {}
            Err(e) => return Err(format!("could not check on telegram-bot-api: {e}")),
        }
        if TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok() {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err(format!(
                "telegram-bot-api did not start listening on port {port} within {}s",
                READY_TIMEOUT.as_secs()
            ));
        }
        std::thread::sleep(Duration::from_millis(150));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exited_process_is_not_reported_as_running() {
        #[cfg(windows)]
        let child = crate::platform::background_command("cmd.exe")
            .args(["/C", "exit", "0"])
            .spawn()
            .unwrap();
        #[cfg(not(windows))]
        let child = std::process::Command::new("/usr/bin/true").spawn().unwrap();
        let mut handle = ServerHandle { child, port: 8081 };
        handle.child.wait().unwrap();
        assert!(handle.check_running().unwrap_err().contains("exited"));
    }

    #[test]
    fn explicit_server_path_supports_spaces_and_rejects_directories() {
        let dir = std::env::temp_dir().join(format!("tele2local server {}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let binary = dir.join(if cfg!(windows) {
            "telegram-bot-api.exe"
        } else {
            "telegram-bot-api"
        });
        std::fs::write(&binary, b"fixture").unwrap();
        assert_eq!(locate_binary(Some(binary.to_str().unwrap())), Some(binary));
        assert_eq!(locate_binary(Some(dir.to_str().unwrap())), None);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
