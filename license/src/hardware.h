#pragma once
#include <string>

namespace svx {

struct HardwareId {
    std::string mac;        // primary NIC MAC address
    std::string cpu;        // CPU brand/model string
    std::string machine;    // machine/board serial (macOS: platform serial)
    std::string fingerprint; // SHA-256(mac|cpu|machine|SALT)
};

HardwareId   collect_hardware_id();
std::string  sha256_hex(const std::string& data);

} // namespace svx
