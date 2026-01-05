use super::keystore::{KeyStore, KeyStoreError};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use keyring::Entry;
use rand::rngs::OsRng;
use std::convert::TryInto;

pub struct KeychainStore {
    service_name: String,
    user_name: String,
    cached_key: Option<SigningKey>,
}

impl KeychainStore {
    pub fn new(service_name: &str, user_name: &str) -> Self {
        Self {
            service_name: service_name.to_string(),
            user_name: user_name.to_string(),
            cached_key: None,
        }
    }

    fn get_entry(&self) -> Result<Entry, KeyStoreError> {
        Entry::new(&self.service_name, &self.user_name)
            .map_err(|e| KeyStoreError::StorageError(e.to_string()))
    }

    /// Load key from keychain or generate if missing
    #[allow(dead_code)]
    fn load_or_generate_key(&mut self) -> Result<SigningKey, KeyStoreError> {
        if let Some(key) = &self.cached_key {
            return Ok(key.clone());
        }

        let entry = self.get_entry()?;

        match entry.get_password() {
            Ok(secret_hex) => {
                // Decode from hex
                let bytes = hex::decode(secret_hex).map_err(|e| {
                    KeyStoreError::StorageError(format!("Invalid key format: {}", e))
                })?;

                let bytes_sized: [u8; 32] = bytes
                    .try_into()
                    .map_err(|_| KeyStoreError::StorageError("Invalid key length".into()))?;

                let key = SigningKey::from_bytes(&bytes_sized);
                self.cached_key = Some(key.clone());
                Ok(key)
            }
            Err(keyring::Error::NoEntry) => {
                // Generate new key
                let mut csprng = OsRng;
                let key = SigningKey::generate(&mut csprng);
                let bytes = key.to_bytes();
                let hex_str = hex::encode(bytes);

                entry
                    .set_password(&hex_str)
                    .map_err(|e| KeyStoreError::StorageError(e.to_string()))?;

                self.cached_key = Some(key.clone());
                Ok(key)
            }
            Err(e) => Err(KeyStoreError::StorageError(e.to_string())),
        }
    }
}

impl KeyStore for KeychainStore {
    fn get_public_key(&self) -> Result<VerifyingKey, KeyStoreError> {
        // We need mutable access to load/cache logic, but trait is immutable self?
        // Actually, we can use RefCell or Mutex for interior mutability if needed,
        // OR we just re-load (keychain access is fast-ish, but caching is better).
        // For this Prototype, let's assume `load_or_generate` is called at init
        // and we cheat by using `self.cached_key` if we had `&mut self`.
        // But `get_public_key` is `&self`.

        // Fix: To implement KeyStore trait correctly without Mutex overhead for now,
        // we might need to populate cache at construction or use a Mutex.
        // Let's change `KeychainStore` to wrap the key in a `std::sync::Mutex` or `std::cell::RefCell`?
        // Or just read from keychain every time (simplest for implementation).

        let entry = self.get_entry()?;
        let secret_hex = entry.get_password().map_err(|e| match e {
            keyring::Error::NoEntry => KeyStoreError::KeyNotFound,
            _ => KeyStoreError::StorageError(e.to_string()),
        })?;

        let bytes =
            hex::decode(secret_hex).map_err(|e| KeyStoreError::StorageError(e.to_string()))?;
        let bytes_sized: [u8; 32] = bytes
            .try_into()
            .map_err(|_| KeyStoreError::StorageError("Invalid key length".into()))?;
        let key = SigningKey::from_bytes(&bytes_sized);

        Ok(key.verifying_key())
    }

    fn sign(&self, message: &[u8]) -> Result<Signature, KeyStoreError> {
        let entry = self.get_entry()?;
        let secret_hex = entry
            .get_password()
            .map_err(|e| KeyStoreError::StorageError(e.to_string()))?;
        let bytes =
            hex::decode(secret_hex).map_err(|e| KeyStoreError::StorageError(e.to_string()))?;
        let bytes_sized: [u8; 32] = bytes
            .try_into()
            .map_err(|_| KeyStoreError::StorageError("Invalid key length".into()))?;
        let key = SigningKey::from_bytes(&bytes_sized);

        Ok(key.sign(message))
    }

    fn rotate_key(&mut self) -> Result<VerifyingKey, KeyStoreError> {
        let mut csprng = OsRng;
        let key = SigningKey::generate(&mut csprng);
        let bytes = key.to_bytes();
        let hex_str = hex::encode(bytes);

        let entry = self.get_entry()?;
        entry
            .set_password(&hex_str)
            .map_err(|e| KeyStoreError::StorageError(e.to_string()))?;

        self.cached_key = Some(key.clone());
        Ok(key.verifying_key())
    }
}
