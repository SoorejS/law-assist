#include "crypto.h"
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/rand.h>
#include <openssl/sha.h>
#include <stdexcept>
#include <sstream>
#include <iomanip>
#include <cstring>

namespace svx {

// ── AES-256-GCM ────────────────────────────────────────────────────────────────
// Format: [12-byte IV][16-byte tag][ciphertext]

std::vector<uint8_t> aes_encrypt(const std::string& plaintext, const std::string& key32) {
    if (key32.size() != 32) throw std::runtime_error("Key must be 32 bytes");

    uint8_t iv[12];
    RAND_bytes(iv, sizeof(iv));

    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    if (!ctx) throw std::runtime_error("EVP_CIPHER_CTX_new failed");

    EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr);
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, nullptr);
    EVP_EncryptInit_ex(ctx, nullptr, nullptr,
        reinterpret_cast<const uint8_t *>(key32.data()), iv);

    std::vector<uint8_t> ciphertext(plaintext.size() + 16);
    int len = 0, total = 0;
    EVP_EncryptUpdate(ctx, ciphertext.data(),
        &len, reinterpret_cast<const uint8_t *>(plaintext.data()), plaintext.size());
    total = len;
    EVP_EncryptFinal_ex(ctx, ciphertext.data() + total, &len);
    total += len;
    ciphertext.resize(total);

    uint8_t tag[16];
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag);
    EVP_CIPHER_CTX_free(ctx);

    // Prepend IV + tag
    std::vector<uint8_t> result;
    result.insert(result.end(), iv, iv + 12);
    result.insert(result.end(), tag, tag + 16);
    result.insert(result.end(), ciphertext.begin(), ciphertext.end());
    return result;
}

std::string aes_decrypt(const std::vector<uint8_t>& data, const std::string& key32) {
    if (key32.size() != 32) throw std::runtime_error("Key must be 32 bytes");
    if (data.size() < 28) throw std::runtime_error("Ciphertext too short");

    const uint8_t *iv  = data.data();
    const uint8_t *tag = data.data() + 12;
    const uint8_t *ct  = data.data() + 28;
    size_t ct_len = data.size() - 28;

    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr);
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, nullptr);
    EVP_DecryptInit_ex(ctx, nullptr, nullptr,
        reinterpret_cast<const uint8_t *>(key32.data()), iv);

    std::string plaintext(ct_len, '\0');
    int len = 0;
    EVP_DecryptUpdate(ctx, reinterpret_cast<uint8_t *>(plaintext.data()),
        &len, ct, ct_len);

    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16, const_cast<uint8_t *>(tag));
    int ok = EVP_DecryptFinal_ex(ctx, reinterpret_cast<uint8_t *>(plaintext.data()) + len, &len);
    EVP_CIPHER_CTX_free(ctx);

    if (ok <= 0) throw std::runtime_error("AES-GCM tag verification failed — tampered license");
    return plaintext;
}

// ── HMAC-SHA256 ────────────────────────────────────────────────────────────────

std::string hmac_sha256_hex(const std::string& data, const std::string& key) {
    uint8_t digest[EVP_MAX_MD_SIZE];
    unsigned int dlen = 0;
    HMAC(EVP_sha256(),
         key.data(), key.size(),
         reinterpret_cast<const uint8_t *>(data.data()), data.size(),
         digest, &dlen);
    std::ostringstream ss;
    for (unsigned i = 0; i < dlen; ++i)
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(digest[i]);
    return ss.str();
}

// ── PBKDF2-SHA256 key derivation ───────────────────────────────────────────────

std::string derive_key(const std::string& password, const std::string& salt) {
    std::string key(32, '\0');
    PKCS5_PBKDF2_HMAC(
        password.data(), password.size(),
        reinterpret_cast<const uint8_t *>(salt.data()), salt.size(),
        100000,           // iterations
        EVP_sha256(),
        32,               // output key length
        reinterpret_cast<uint8_t *>(key.data()));
    return key;
}

} // namespace svx
