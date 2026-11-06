# Usage & troubleshooting

[← Overview and quick start](../README.md)

## Where files go

Each bot writes to one Markdown file. Choose an existing file with **Browse…**, or choose a location with **New file…**. The file is created on the first note; clicking its path also creates an empty note if needed.

Use a full path: `/Users/you/Notes/ideas.md` on Mac or `C:\Users\you\Notes\ideas.md` on Windows. The **Files folder** is optional; blank uses `attachments` beside the note. Attachment filenames contain a timestamp and unique ID. A saved attachment adds its path and caption to the note.

The separate **Send-back file** is read-only. Opening a missing send-back file reports an error rather than creating a replacement.

## Daily send-back

- Sends to the private chat for your configured Telegram user ID. Open your bot and tap **Start** first.
- Uses your computer’s local time. Requires an enabled bot and a running app.
- Reads the whole UTF-8 text file and splits long content into messages.
- Skips empty files. A missing or unreadable file is shown as an error.
- No catch-up on a late launch. A send failure is reported; the next scheduled attempt is the following day.

## Keep it available

**Mac:** add Tele2Local in System Settings → Login Items. Older macOS versions put Login Items under Users & Groups. The app runs after you log in.

**Windows:** put a shortcut to Tele2Local in the folder opened by `shell:startup` in Run (Win+R).

Closing a window hides it. Quit through the menu bar or tray menu. A sleeping, offline, or logged-out computer cannot capture messages or send the daily file until it is running again. Telegram does not keep pending bot updates indefinitely, so do not use it as a long-term offline queue.

## When something does not work

| What you see | What to check |
| --- | --- |
| No window | Choose **Open Manager** from the menu bar/system tray; check hidden tray icons on Windows. |
| Token validation fails | Copy the token again from BotFather; check connectivity and any Bot API override. |
| Bot is connected but saves nothing | Use the correct private bot chat and numeric user ID. Only text and downloadable attachments are supported. |
| A 409 conflict | Stop the other copy of the app or service polling the same token. One token has one poller. |
| File write/download error | Check the destination folder, disk space, and permissions. Fix the path in **Edit**; temporary failures retry. |
| Shortcut unavailable | Record another combination including Command, Control, Alt, or Windows. Another app may own it. **Write note** remains available. |
| Daily send does not arrive | Tap Start in the bot chat, set your user ID, enable the bot, and keep the app running before the scheduled time. Check the displayed daily error. |
| Windows note link opens the wrong app | Set the `.md` file association to your preferred editor. With no association, Tele2Local falls back to Notepad. |
| macOS blocks an unsigned download | Only for a build you trust, remove its quarantine flag after moving it to Applications: `xattr -dr com.apple.quarantine /Applications/Tele2Local.app`. |

## Large attachments: optional local Bot API server

The public Telegram Bot API limits downloads to about **20 MB**. An oversized attachment produces a “could not save file” note rather than a successful save. The optional local API server removes that download limit; it is not required for ordinary notes.

1. Build [`telegram-bot-api`](https://tdlib.github.io/telegram-bot-api/build.html) for your OS.
2. Obtain `api_id` and `api_hash` from [my.telegram.org](https://my.telegram.org).
3. Open **Local server** in Tele2Local, enable it, enter those credentials, and choose the binary path. On Windows use `telegram-bot-api.exe`; on Mac common Homebrew paths are also checked. Both platforms search PATH.
4. A bot previously used with the public API must call Telegram’s [`logOut`](https://core.telegram.org/bots/api#logout) method before moving to the local server. Avoid putting your token into shared logs or screenshots.

The managed process listens on `127.0.0.1` only. If startup fails, the dialog confirms that settings were saved and shows the server error; correct it and save again to retry. Exited processes are reported as stopped. Diagnostics are in `bot-api/server.log` beside `bots.json`. Explicit per-bot API overrides take precedence over the managed server. The server’s cache retains downloaded originals, so allow disk space for both cache and saved attachments. Quit normally to stop the child process; a force-quit can leave it running.

## Settings, backup, and recovery

Settings and state live under:

- Mac: `~/Library/Application Support/com.notekeeper.desktop/`
- Windows: `%APPDATA%\com.notekeeper.desktop\`

`bots.json` stores bindings; `status.json` stores counters and polling progress; `pending-*.json` stores unfinished attachment jobs. Back up your notes and attachments separately. Tokens are in the OS credential store under `com.notekeeper.app`, so copying settings to another computer requires re-entering tokens.

If a download queue cannot be read, the bot stops and reports it rather than overwriting it. Unreadable saved progress or an unavailable credential store stops startup to protect existing data. Preserve the original state files before attempting repair. Corrupt JSON configuration is moved to a `.corrupt-*` sibling. Avoid editing state files while the app is running.

## Durability and external processing

Successful note writes and attachment saves are synced before confirmation. Cooperating processors should lock the same sidecar file (`.notes.md.lock` beside `notes.md`) while rewriting a log. On macOS this is an advisory `flock`; programs that ignore it can still race with capture.

The note file and saved-progress file are separate writes. An abrupt termination between them can replay an entry on restart; bounded update tracking reduces replay but is not an exactly-once transaction. Back up important data and make batch processing tolerant of duplicate entries. Filesystem sync does not guarantee recovery from hardware failure.
