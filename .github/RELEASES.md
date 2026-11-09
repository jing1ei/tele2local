# Automatic releases

The public filenames and supported platforms are defined in [Package contract](PACKAGING.md).
The application version comes from `src-tauri/Cargo.toml`. Update its matching platform manifests
and bump the patch version when changing the packaged release.

A push to main builds and tests every required platform. The publish job receives
only the verified workflow artifacts and has exclusive write permission.
It validates the package set and SHA-256 checksums, uploads into a draft,
downloads the assets again to verify their hashes, then publishes the release.

Published versions and tags are immutable. A later build of an already published
version leaves the public release intact. An interrupted draft can be retried
from the same commit. A build superseded by another main commit cannot publish.

macOS downloads are separate Apple silicon and Intel DMGs. The contained app
retains the project's existing signing policy. Signing and notarization requirements
are described in the README. Source exports inside the application are independent
of public release packaging.
