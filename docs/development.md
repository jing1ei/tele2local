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
python -m unittest discover -s tests -p 'test_release_version.py'
python .github/scripts/test_release.py
```

Frontend tests need Node.js 22+ and no npm dependencies. CI runs native checks on macOS and Windows and separately builds Intel Mac code. The release workflow produces a universal Mac build and a Windows x64 installer. Builds are unsigned unless signing is configured.

## GitHub release

Push the source to GitHub with Actions enabled. Every push to `main` (and every manual **Actions → Release → Run workflow**) validates the version, runs CI, builds both installers, and then refreshes a single public, rolling **1.0.0** release at tag `v1.0.0`. There is nothing to tag by hand.

The workflow requires the version string in `Cargo.toml`, `Cargo.lock`, and `tauri.conf.json` to agree. After every platform build passes, the publisher uploads a universal Mac DMG and a Windows x64 setup executable plus `SHA256SUMS.txt` into the release, downloads each asset and verifies its checksum, moves `v1.0.0` to the built commit, and only then publishes it. A failed or stale build never moves the tag and leaves any existing release untouched. Artifacts from manual runs are retained for 14 days. See [.github/RELEASES.md](../.github/RELEASES.md) for the full policy and [.github/release.json](../.github/release.json) for the required asset names. Release builds use Tauri CLI 2.12.0 and a pinned Tauri action revision.

### Versioned releases and on-demand builds (`build.yml`)

A second workflow, **Build**, produces discrete releases independent of the rolling 1.0.0 pipeline:

- **Tag a version** to cut a release:
  ```bash
  # 1. Bump the version in all three places so they agree
  #    src-tauri/Cargo.toml, src-tauri/Cargo.lock, src-tauri/tauri.conf.json
  git tag v1.2.3
  git push origin v1.2.3
  ```
  The tag must be `v` + the exact `MAJOR.MINOR.PATCH` in `Cargo.toml`; otherwise the `prepare` job fails before anything builds. On success the workflow runs CI, builds the universal macOS DMG and the Windows x64 installer, uploads both with a `SHA256SUMS.txt`, and creates/publishes a GitHub Release named after the tag. Re-running the tag workflow updates the same release (`--clobber`). A prerelease tag such as `v1.2.3-rc1` is marked prerelease and is not set "latest".
- **Run workflow manually** via **Actions → Build → Run workflow** on any branch to build both packages without creating or changing a release; they are kept as workflow artifacts for 30 days.

A tagged build cannot be superseded by a newer push (its concurrency group never cancels in-progress runs). The two release pipelines have distinct triggers — `main` pushes drive the rolling 1.0.0 release, `v*` tags drive versioned releases — so they never both fire for one event.

## Compatibility and credentials

The Cargo package and executable are `tele2local`; application bundles use `Tele2Local`.

Keep the bundle ID `com.notekeeper.desktop` and credential service `com.notekeeper.app` stable: changing them strands existing settings or tokens. OS-specific file opening lives in `platform.rs`; shortcut labels and modifier mapping live in `platform.js`. Persistent keyring backends are selected per platform in Cargo.toml.

## Icons and screenshots

`assets/app-icon.svg` is the editable icon source; `app-icon.png` is its 1024×1024 export. Regenerate desktop icons with `cargo tauri icon app-icon.png`; mobile assets are not tracked.

The README screenshots in `docs/screenshots/` are captures of the actual frontend served with a local demo bridge. All names, paths, counts, and attachments are fictional. They illustrate manager, quick capture, and daily-send UI; they do not verify native dialogs, OS hotkeys, Keychain/Credential Manager, or Telegram delivery. Retake screenshots after changing the corresponding UI. Do not capture real credentials or private note contents.
