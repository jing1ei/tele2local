# Build & development

[← Overview](../README.md)

The frontend is static HTML/CSS/JavaScript in `src/`; the Tauri/Rust backend is in `src-tauri/`. There is no frontend build step. Shared light-theme tokens live in `src/theme.css`; both windows use the same pink-and-blue palette.

## macOS

Install Xcode command-line tools (`xcode-select --install`) and [Rust](https://rustup.rs), then:

```bash
cargo install tauri-cli --version "^2" --locked
cargo tauri dev
cargo tauri build
```

The native app bundle is under `src-tauri/target/release/bundle/macos/`; disk images are under `bundle/dmg/`.

For a universal Intel + Apple Silicon release:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
MACOSX_DEPLOYMENT_TARGET=11.0 cargo tauri build --target universal-apple-darwin
```

Universal outputs are under `src-tauri/target/universal-apple-darwin/release/bundle/`. The deployment target is macOS 11.0. A successful modern-Mac build does not replace a launch test on Big Sur.

## Windows x64

Install Rust’s MSVC toolchain, Visual Studio Build Tools with **Desktop development with C++**, and Microsoft Edge WebView2. Then:

```powershell
cargo install tauri-cli --version "^2" --locked
cargo tauri dev
cargo tauri build --target x86_64-pc-windows-msvc
```

Tauri automatically merges `tauri.windows.conf.json`. The per-user NSIS installer is under `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`; it downloads WebView2 if needed. Full Windows builds require a Windows SDK/toolchain, not just the Rust target.

## Checks

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path src-tauri/Cargo.toml
node --test tests/manager.test.cjs tests/quick.test.cjs tests/platform.test.cjs
python3 -m unittest discover -s tests -p 'test_release_version.py'
python3 .github/scripts/test_release.py
```

Frontend tests need Node.js 22+ and no npm dependencies; release checks need Python 3.11+. CI runs native checks on macOS and Windows and separately builds Intel Mac code. The release workflow produces a universal Mac build and a Windows x64 installer. Builds are unsigned unless signing is configured.

## GitHub release

Push to `main` to run checks, build both installers, and refresh the rolling 1.0.0 release. **Actions → Release → Run workflow** does the same on `main`; other branches build artifacts without publishing. There is no tag-triggered second pipeline. See [release policy](../.github/RELEASES.md).

## Compatibility and credentials

The Cargo package and executable are `tele2local`; application bundles use `Tele2Local`.

Keep the bundle ID `com.notekeeper.desktop` and credential service `com.notekeeper.app` stable: changing them strands existing settings or tokens. OS-specific file opening lives in `platform.rs`; shortcut labels and modifier mapping live in `platform.js`. Persistent keyring backends are selected per platform in Cargo.toml.

## Icons and screenshots

`assets/app-icon.svg` is the editable icon source; `app-icon.png` is its 1024×1024 export. Regenerate desktop icons with `cargo tauri icon app-icon.png`; mobile assets are not tracked.

Screenshots in `docs/screenshots/` use fictional data. Retake them after UI changes without including credentials or private notes.
