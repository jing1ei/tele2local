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
node --test tests/manager.test.cjs tests/quick.test.cjs tests/platform.test.cjs tests/release.test.cjs
```

Frontend tests need Node.js 22+ and no npm dependencies. CI runs native checks on macOS and Windows and separately builds Intel Mac code. The release workflow produces a universal Mac build and a Windows x64 installer. Tag pushes create draft releases; manual runs retain downloadable workflow artifacts. Builds are unsigned unless signing is configured.

## GitHub release

Push the source to GitHub with Actions enabled. A normal push to `main` runs CI; it does not create a release. To release version 1.0.0:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tag must exactly match `v` plus the Cargo version. The release workflow validates the version, runs CI, builds both installers, and only then creates one **draft** release with a universal Mac DMG, Windows x64 setup executable, and SHA-256 checksums. Publish the draft after reviewing it. No personal access token is needed: the publish job uses GitHub's automatic token with `contents: write` permission.

Manual **Actions → Release → Run workflow** runs checks and builds artifacts without creating a release, even when a tag is selected. Artifacts are retained for 14 days. Failed platform builds prevent release creation. Reruns can replace assets on an existing draft but refuse to modify a published release. Release builds use Tauri CLI 2.12.0 and a pinned Tauri action revision.

## Compatibility and credentials

The Cargo package and executable are `tele2local`; application bundles use `Tele2Local`.

Keep the bundle ID `com.notekeeper.desktop` and credential service `com.notekeeper.app` stable: changing them strands existing settings or tokens. OS-specific file opening lives in `platform.rs`; shortcut labels and modifier mapping live in `platform.js`. Persistent keyring backends are selected per platform in Cargo.toml.

## Icons and screenshots

`assets/app-icon.svg` is the editable icon source; `app-icon.png` is its 1024×1024 export. Regenerate desktop icons with `cargo tauri icon app-icon.png`; mobile assets are not tracked.

The README screenshots in `docs/screenshots/` are captures of the actual frontend served with a local demo bridge. All names, paths, counts, and attachments are fictional. They illustrate manager, quick capture, and daily-send UI; they do not verify native dialogs, OS hotkeys, Keychain/Credential Manager, or Telegram delivery. Retake screenshots after changing the corresponding UI. Do not capture real credentials or private note contents.
