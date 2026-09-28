//! Small OS-specific operations; note content and credentials never pass through a shell.
use std::path::Path;

#[cfg(target_os = "macos")]
pub fn open_note(path: &Path) -> Result<(), String> {
    let status = std::process::Command::new("open")
        .arg("-t")
        .arg("--")
        .arg(path)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("could not open the file ({status})"))
    }
}

#[cfg(target_os = "windows")]
pub fn open_note(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    if wide[..wide.len() - 1].contains(&0) {
        return Err("file path contains a NUL character".into());
    }
    // SAFETY: the UTF-16 path is NUL-terminated and lives through the call.
    // No parameters are supplied, so filenames cannot become shell commands.
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            std::ptr::null(),
            wide.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    } as isize;
    if result > 32 {
        return Ok(());
    }
    // Markdown often has no default association on a fresh Windows install.
    if result == 31 {
        let mut editor = std::process::Command::new(
            std::env::var_os("SystemRoot")
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|| std::path::PathBuf::from(r"C:\Windows"))
                .join("System32")
                .join("notepad.exe"),
        )
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
        std::thread::spawn(move || {
            let _ = editor.wait();
        });
        return Ok(());
    }
    Err(format!("Windows could not open this file (error {result})"))
}

/// Keep background helper processes from flashing a console on Windows.
pub fn background_command(program: impl AsRef<std::ffi::OsStr>) -> std::process::Command {
    #[allow(unused_mut)]
    let mut command = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    command
}
