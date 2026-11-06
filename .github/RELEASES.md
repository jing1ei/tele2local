# Automatic releases

Pushes to `main` and manual **Release** runs on `main` refresh the rolling **1.0.0** release at `v1.0.0`. Other branches only produce workflow artifacts, retained for 14 days. CI runs once per release workflow and separately for pull requests.

All checks and both platform builds must pass. Downloads are:

- `Tele2Local-1.0.0-macOS-universal.dmg`
- `Tele2Local-1.0.0-Windows-x64.exe`
- `Tele2Local-1.0.0-source.zip`
- `SHA256SUMS.txt` covering the three packages

The publisher rejects stale builds before uploading, downloads assets to verify checksums, checks `main` again, then moves the tag and updates release metadata. New releases remain draft until verified; existing releases stay public during refresh. GitHub asset replacement is not atomic: a failed upload can leave mixed assets, but does not advance the tag. Rerun the latest `main` workflow to repair an interrupted refresh.

Only the publication job has `contents: write`. Installers are unsigned. The package contract is in [release.json](release.json); changing the rolling version requires updating that contract, the publisher, workflow filenames, and all application version fields together.
