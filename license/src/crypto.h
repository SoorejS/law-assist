#pragma once
#include <string>
#include <vector>

namespace svx {

// AES-256-GCM encrypt/decrypt (key must be 32 bytes)
std::vector<uint8_t> aes_encrypt(const std::string& plaintext, const std::string& key32);
std::string          aes_decrypt(const std::vector<uint8_t>& ciphertext, const std::string& key32);

// HMAC-SHA256 — used to sign cloud escalation requests
std::string hmac_sha256_hex(const std::string& data, const std::string& key);

// Derive a 32-byte AES key from a password + salt using PBKDF2-SHA256
std::string derive_key(const std::string& password, const std::string& salt);

} // namespace svx
