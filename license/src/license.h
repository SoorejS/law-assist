#pragma once
#include <string>
#include <ctime>

namespace saravonix {

struct HardwareId {
    std::string mac_address;
    std::string cpu_id;
    std::string disk_serial;
    std::string fingerprint;  // SHA-256(mac + cpu_id + disk_serial + salt)
};

struct License {
    std::string license_key;
    std::string customer_id;
    std::string fingerprint;
    int         seat_count;        // max concurrent users (1–20)
    std::time_t expiry_epoch;
    bool        cloud_enabled;
    std::string vertical;          // law_firm | ca_firm | generic
    std::string sarvam_tier;       // local_only | pravah_basic | pravah_pro
};

enum class LicenseStatus {
    VALID,
    EXPIRED,
    FINGERPRINT_MISMATCH,
    SEAT_LIMIT_EXCEEDED,
    NOT_FOUND,
    INVALID_KEY,
};

// ── Hardware fingerprinting ────────────────────────────────────────────────────
HardwareId   collect_hardware_id();
std::string  compute_fingerprint(const HardwareId& hw, const std::string& salt);

// ── License file operations ────────────────────────────────────────────────────
bool         save_license(const License& lic, const std::string& path);
bool         load_license(License& lic, const std::string& path);

// ── Validation ────────────────────────────────────────────────────────────────
LicenseStatus validate_license(const License& lic, const HardwareId& hw);
bool          check_seat(const std::string& session_id);
void          release_seat(const std::string& session_id);

// ── Cloud request signing ──────────────────────────────────────────────────────
// Sign a cloud escalation request with the license HMAC.
// The Saravonix proxy verifies this before forwarding to Sarvam/Claude.
std::string sign_cloud_request(
    const std::string& payload,
    const std::string& license_key
);

// ── IPC (named pipe / Unix socket) ────────────────────────────────────────────
// The Python engine communicates with the daemon via a local socket.
void run_daemon(const std::string& socket_path);

} // namespace saravonix
