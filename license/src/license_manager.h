#pragma once
#include <string>
#include <ctime>

namespace svx {

enum class LicenseStatus {
    VALID,
    EXPIRED,
    FINGERPRINT_MISMATCH,
    NOT_FOUND,
    CORRUPT,
};

struct License {
    std::string license_key;
    std::string customer_id;
    std::string customer_name;
    std::string fingerprint;
    int         seat_count       = 1;
    bool        cloud_enabled    = true;
    std::string vertical         = "generic";
    std::string sarvam_tier      = "pravah_basic"; // pravah_basic | pravah_pro
    std::time_t expiry_epoch     = 0;
    std::time_t issued_at        = 0;
};

// Save a license to disk (AES-256-GCM encrypted, key derived from HW fingerprint)
bool save_license(const License& lic, const std::string& path, const std::string& hw_fingerprint);

// Load and decrypt a license file
bool load_license(License& lic, const std::string& path, const std::string& hw_fingerprint);

// Validate a loaded license against the current HW fingerprint
LicenseStatus validate_license(const License& lic, const std::string& hw_fingerprint);

const char* status_to_str(LicenseStatus s);

} // namespace svx
