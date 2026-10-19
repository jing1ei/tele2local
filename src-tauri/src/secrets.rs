//! Bot tokens in macOS Keychain or Windows Credential Manager.

use crate::config::Config;
use keyring::Entry;

/// Keychain service name.
const SERVICE: &str = "com.notekeeper.app";

/// Fixed Keychain key for the global local-server `api_hash`. The leading
/// underscores keep it from ever colliding with a bot's UUID.
const SERVER_HASH_KEY: &str = "__server_api_hash__";

/// Read the local-server `api_hash` from the Keychain.
pub fn get_server_api_hash() -> Result<Option<String>, String> {
    get_token(SERVER_HASH_KEY)
}

/// Store (or replace) the local-server `api_hash` in the Keychain.
pub fn set_server_api_hash(hash: &str) -> Result<(), String> {
    set_token(SERVER_HASH_KEY, hash)
}

/// Remove the local-server `api_hash` from the Keychain. Used to roll back to
/// "no hash stored" — writing an empty string instead would leave a Keychain
/// entry behind that reads back as `Some("")`.
pub fn clear_server_api_hash() {
    delete_token(SERVER_HASH_KEY);
}

/// Missing credentials return None; store failures remain errors.
pub fn get_token(id: &str) -> Result<Option<String>, String> {
    match Entry::new(SERVICE, id).and_then(|entry| entry.get_password()) {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("cannot read credential store: {e}")),
    }
}

/// Store (or replace) a bot's token in the Keychain.
pub fn set_token(id: &str, token: &str) -> Result<(), String> {
    Entry::new(SERVICE, id)
        .and_then(|e| e.set_password(token))
        .map_err(|e| e.to_string())
}

/// Delete a bot's token from the Keychain. Missing entries are ignored.
pub fn delete_token(id: &str) {
    if let Ok(e) = Entry::new(SERVICE, id) {
        let _ = e.delete_credential();
    }
}

/// Fill each bot's in-memory token from the Keychain.
pub fn hydrate_tokens(config: &mut Config) -> Result<bool, String> {
    let mut migrated = false;
    for b in &mut config.bots {
        if !b.token.is_empty() {
            // Never strip any plaintext credential until all migrations succeed.
            set_token(&b.id, &b.token)?;
            migrated = true;
        } else {
            b.token = get_token(&b.id)?.unwrap_or_default();
        }
    }
    if !config.server.api_hash.is_empty() {
        set_server_api_hash(&config.server.api_hash)?;
        migrated = true;
    } else {
        config.server.api_hash = get_server_api_hash()?.unwrap_or_default();
    }
    Ok(migrated)
}
