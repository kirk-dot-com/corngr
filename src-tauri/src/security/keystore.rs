use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum KeyStoreError {
    #[error("Key not found")]
    KeyNotFound,
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("Crypto error: {0}")]
    CryptoError(String),
}

/// Trait for Secure Key Storage
/// The implementation should handle the secure storage of the private key.
/// The interface only exposes signing capabilities, never the private key itself.
pub trait KeyStore {
    /// Get the public key associated with the current identity
    fn get_public_key(&self) -> Result<VerifyingKey, KeyStoreError>;

    /// Sign a message using the stored private key
    fn sign(&self, message: &[u8]) -> Result<Signature, KeyStoreError>;

    /// Rotate the key (generate new keypair and store it)
    fn rotate_key(&mut self) -> Result<VerifyingKey, KeyStoreError>;
}
