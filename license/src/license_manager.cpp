#include "license_manager.h"
#include "crypto.h"
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <cstring>
#include <ctime>

static std::string json_get(const std::string& json, const std::string& key) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return {};
    pos = json.find(':', pos);
    if (pos == std::string::npos) return {};
    pos = json.find_first_not_of(" \t\n\r", pos + 1);
    if (pos == std::string::npos) return {};
    if (json[pos] == '"') {
        auto end = json.find('"', pos + 1);
        return json.substr(pos + 1, end - pos - 1);
    }
    auto end = json.find_first_of(",}\n", pos);
    return json.substr(pos, end - pos);
}

static std::string license_to_json(const svx::License& l) {
    std::ostringstream o;
    o << "{"
      << "\"license_key\":\"" << l.license_key << "\","
      << "\"customer_id\":\"" << l.customer_id << "\","
      << "\"customer_name\":\"" << l.customer_name << "\","
      << "\"fingerprint\":\"" << l.fingerprint << "\","
      << "\"seat_count\":" << l.seat_count << ","
      << "\"cloud_enabled\":" << (l.cloud_enabled ? "true" : "false") << ","
      << "\"vertical\":\"" << l.vertical << "\","
      << "\"sarvam_tier\":\"" << l.sarvam_tier << "\","
      << "\"expiry_epoch\":" << l.expiry_epoch << ","
      << "\"issued_at\":" << l.issued_at
      << "}";
    return o.str();
}

static svx::License json_to_license(const std::string& json) {
    svx::License l;
    l.license_key   = json_get(json, "license_key");
    l.customer_id   = json_get(json, "customer_id");
    l.customer_name = json_get(json, "customer_name");
    l.fingerprint   = json_get(json, "fingerprint");
    l.vertical      = json_get(json, "vertical");
    l.sarvam_tier   = json_get(json, "sarvam_tier");
    auto sc    = json_get(json, "seat_count");
    auto exp   = json_get(json, "expiry_epoch");
    auto iss   = json_get(json, "issued_at");
    auto cloud = json_get(json, "cloud_enabled");
    if (!sc.empty())  l.seat_count   = std::stoi(sc);
    if (!exp.empty()) l.expiry_epoch = std::stoll(exp);
    if (!iss.empty()) l.issued_at    = std::stoll(iss);
    l.cloud_enabled = (cloud == "true");
    return l;
}

namespace svx {

// File format: [64-byte license_key header (plaintext)][AES-256-GCM ciphertext]
// The license_key is not secret — only the HW fingerprint (used as the PBKDF2 password) is.

bool save_license(const License& lic, const std::string& path, const std::string& hw_fingerprint) {
    try {
        std::string plaintext = license_to_json(lic);
        std::string key = derive_key(hw_fingerprint, lic.license_key);
        auto encrypted = aes_encrypt(plaintext, key);

        std::ofstream f(path, std::ios::binary);
        if (!f) return false;

        char header[64] = {};
        strncpy(header, lic.license_key.c_str(), 63);
        f.write(header, 64);
        f.write(reinterpret_cast<const char *>(encrypted.data()), encrypted.size());
        return true;
    } catch (...) {
        return false;
    }
}

bool load_license(License& lic, const std::string& path, const std::string& hw_fingerprint) {
    std::ifstream f(path, std::ios::binary);
    if (!f) return false;

    std::vector<uint8_t> data((std::istreambuf_iterator<char>(f)),
                               std::istreambuf_iterator<char>());
    if (data.size() < 64) return false;

    try {
        std::string license_key(data.begin(), data.begin() + 64);
        license_key = license_key.substr(0, license_key.find('\0'));

        std::vector<uint8_t> encrypted(data.begin() + 64, data.end());
        std::string key = derive_key(hw_fingerprint, license_key);
        std::string plaintext = aes_decrypt(encrypted, key);
        lic = json_to_license(plaintext);
        return true;
    } catch (...) {
        return false;
    }
}

LicenseStatus validate_license(const License& lic, const std::string& hw_fingerprint) {
    if (lic.license_key.empty()) return LicenseStatus::NOT_FOUND;
    if (lic.fingerprint != hw_fingerprint) return LicenseStatus::FINGERPRINT_MISMATCH;
    std::time_t now = std::time(nullptr);
    if (lic.expiry_epoch > 0 && now > lic.expiry_epoch) return LicenseStatus::EXPIRED;
    return LicenseStatus::VALID;
}

const char* status_to_str(LicenseStatus s) {
    switch (s) {
        case LicenseStatus::VALID:                return "VALID";
        case LicenseStatus::EXPIRED:              return "EXPIRED";
        case LicenseStatus::FINGERPRINT_MISMATCH: return "FINGERPRINT_MISMATCH";
        case LicenseStatus::NOT_FOUND:            return "NOT_FOUND";
        case LicenseStatus::CORRUPT:              return "CORRUPT";
    }
    return "UNKNOWN";
}

} // namespace svx
