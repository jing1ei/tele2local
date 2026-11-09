<img src="app-icon.png" alt="Tele2Local" width="128" height="128">

# Tele2Local

Save Telegram messages and attachments to local files for later processing. Tele2Local runs in the macOS menu bar or Windows system tray. It also offers local quick capture and scheduled send-back of a text file.

![Bot manager](docs/screenshots/manager.jpg)

## Download packages

Choose the package for your computer from [GitHub Releases](https://github.com/jing1ei/tele2local/releases/latest).

| Computer | Package |
| --- | --- |
| Mac with Apple silicon | `Tele2Local-1.0.1-macOS-arm64.dmg` |
| Mac with Intel | `Tele2Local-1.0.1-macOS-x64.dmg` |
| Windows x64 | `Tele2Local-1.0.1-Windows-x64.exe` |

On macOS, open the DMG and drag the app to Applications. On Windows, run the EXE installer.
Each release includes one source ZIP and `SHA256SUMS.txt`.

## Install

Download the installers and checksums from the [latest release](https://github.com/jing1ei/tele2local/releases/latest):

- **macOS 11+:** open the arm64 DMG (Apple silicon) or x64 DMG (Intel) and move Tele2Local to Applications. Supports Intel and Apple Silicon.
- **Windows 10/11 x64:** run the setup EXE. It installs WebView2 if needed.

Builds are unsigned. For a trusted Mac download blocked by quarantine, run `xattr -dr com.apple.quarantine /Applications/Tele2Local.app` after installation. Big Sur launch compatibility still needs on-device verification. [Build from source](docs/development.md).

## Connect and capture

1. Create a bot with Telegram’s **@BotFather** (`/newbot`) and copy its token.
2. Get your numeric Telegram user ID from **@userinfobot**.
3. Choose **Add bot**, enter the token and user ID, and **Validate token**.
4. Choose **New file…** or **Browse…** for the Markdown log, then save.
5. Open the bot’s private chat, tap **Start**, and send text or a file.

A 👍 reaction confirms a saved note; **✅ Saved** confirms an attachment. Attachments go into `attachments` beside the log unless you choose a **Files folder**. The public Bot API download limit is about 20 MB; [local server setup](docs/usage.md#large-attachments-optional-local-bot-api-server) supports larger files.

Set your own user ID: entering `0` allows anyone who finds the bot to write to your files. Keep the computer awake, online, and the app running. Closing the manager hides it; quit through the tray menu.

## Local notes and daily send-back

**Write note** opens quick capture. Type or drop files, then press **Enter** to save, **Shift+Enter** for a newline, or **Esc** to discard. Set a global shortcut under **Edit → Local shortcut → Record**. Drafts survive switching bots until the app exits; originals of dropped files stay untouched.

**Edit → Daily send-back** sends a text file’s contents to your Telegram user ID at a local time. Blank **Send-back file** uses the bot’s log. The bot must be enabled. Empty files are skipped, long files split, and late launches do not catch up.

Tele2Local captures and stores data; any agent processing or summarization is scheduled separately. Telegram messages still travel through Telegram.

## Data and releases

Tokens use macOS Keychain or Windows Credential Manager. Removing a bot leaves saved notes and attachments intact. See [usage and recovery](docs/usage.md) for settings paths, backups, and durability limits.

A successful `main` build publishes a new version once, with both Mac DMGs, the Windows installer, a source ZIP and `SHA256SUMS.txt`. Published versions are immutable. [Release policy](.github/RELEASES.md) · [Development](docs/development.md) · [Security](SECURITY.md).

Screenshots use fictional demo data.

## Rights

Copyright © 2026. All rights reserved. No licence is granted. Use, copying, modification, distribution, or derivative works require prior written permission from the copyright holder. Third-party dependencies retain their own licences.
