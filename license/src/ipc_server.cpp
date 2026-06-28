#include "ipc_server.h"
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <cstring>
#include <sstream>
#include <iostream>
#include <ctime>

// ── Minimal JSON helpers ───────────────────────────────────────────────────────
static std::string json_str(const std::string& key, const std::string& val) {
    return "\"" + key + "\":\"" + val + "\"";
}
static std::string json_int(const std::string& key, int val) {
    return "\"" + key + "\":" + std::to_string(val);
}
static std::string json_bool(const std::string& key, bool val) {
    return "\"" + key + "\":" + (val ? "true" : "false");
}
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

namespace svx {

IpcServer::IpcServer(const std::string& socket_path,
                     const License& license,
                     const HardwareId& hw,
                     LicenseStatus status)
    : socket_path_(socket_path), license_(license), hw_(hw), status_(status) {}

void IpcServer::stop() {
    running_ = false;
}

std::string IpcServer::handle_request(const std::string& req) {
    std::string action = json_get(req, "action");

    // ── validate ──────────────────────────────────────────────────────────────
    if (action == "validate") {
        std::string status_str = status_to_str(status_);
        bool valid = (status_ == LicenseStatus::VALID);
        std::time_t now = std::time(nullptr);
        int days_left = valid && license_.expiry_epoch > 0
            ? static_cast<int>((license_.expiry_epoch - now) / 86400)
            : 0;
        std::ostringstream o;
        o << "{" << json_str("status", status_str) << ","
                 << json_str("customer_id", license_.customer_id) << ","
                 << json_str("customer_name", license_.customer_name) << ","
                 << json_int("seat_count", license_.seat_count) << ","
                 << json_bool("cloud_enabled", valid && license_.cloud_enabled) << ","
                 << json_str("vertical", license_.vertical) << ","
                 << json_str("sarvam_tier", license_.sarvam_tier) << ","
                 << json_int("days_remaining", days_left) << ","
                 << json_str("fingerprint", hw_.fingerprint)
          << "}";
        return o.str();
    }

    // ── check_seat ────────────────────────────────────────────────────────────
    if (action == "check_seat") {
        std::string session = json_get(req, "session_id");
        bool allowed = check_seat(session);
        std::lock_guard<std::mutex> lock(sessions_mutex_);
        int used = static_cast<int>(active_sessions_.size());
        std::ostringstream o;
        o << "{" << json_bool("allowed", allowed) << ","
                 << json_int("seats_used", used) << ","
                 << json_int("seats_total", license_.seat_count)
          << "}";
        return o.str();
    }

    // ── release_seat ──────────────────────────────────────────────────────────
    if (action == "release_seat") {
        std::string session = json_get(req, "session_id");
        release_seat(session);
        return "{\"ok\":true}";
    }

    // ── sign_cloud ────────────────────────────────────────────────────────────
    if (action == "sign_cloud") {
        if (status_ != LicenseStatus::VALID || !license_.cloud_enabled)
            return "{\"error\":\"license_invalid_or_cloud_disabled\"}";
        std::string payload = json_get(req, "payload");
        std::string sig = hmac_sha256_hex(payload, license_.license_key);
        // Only send a prefix of the key — never expose full key
        std::string key_prefix = license_.license_key.substr(0, 8) + "****";
        std::ostringstream o;
        o << "{" << json_str("signature", sig) << ","
                 << json_str("license_prefix", key_prefix) << ","
                 << json_str("customer_id", license_.customer_id)
          << "}";
        return o.str();
    }

    // ── fingerprint ───────────────────────────────────────────────────────────
    if (action == "fingerprint") {
        std::ostringstream o;
        o << "{" << json_str("fingerprint", hw_.fingerprint) << ","
                 << json_str("mac", hw_.mac) << ","
                 << json_str("machine", hw_.machine)
          << "}";
        return o.str();
    }

    return "{\"error\":\"unknown_action\"}";
}

bool IpcServer::check_seat(const std::string& session_id) {
    std::lock_guard<std::mutex> lock(sessions_mutex_);
    if (active_sessions_.count(session_id)) return true; // already counted
    if (static_cast<int>(active_sessions_.size()) >= license_.seat_count) return false;
    active_sessions_.insert(session_id);
    return true;
}

void IpcServer::release_seat(const std::string& session_id) {
    std::lock_guard<std::mutex> lock(sessions_mutex_);
    active_sessions_.erase(session_id);
}

void IpcServer::run() {
    // Remove stale socket
    ::unlink(socket_path_.c_str());

    int server_fd = ::socket(AF_UNIX, SOCK_STREAM, 0);
    if (server_fd < 0) {
        std::cerr << "[license] Cannot create socket\n";
        return;
    }

    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, socket_path_.c_str(), sizeof(addr.sun_path) - 1);

    if (::bind(server_fd, reinterpret_cast<struct sockaddr *>(&addr), sizeof(addr)) < 0) {
        std::cerr << "[license] bind failed\n";
        ::close(server_fd);
        return;
    }
    ::listen(server_fd, 8);
    std::cerr << "[license] Daemon listening on " << socket_path_ << "\n";

    while (running_) {
        // Non-blocking accept with timeout
        fd_set fds;
        FD_ZERO(&fds);
        FD_SET(server_fd, &fds);
        struct timeval tv{1, 0}; // 1s timeout so we can check running_
        int ready = ::select(server_fd + 1, &fds, nullptr, nullptr, &tv);
        if (ready <= 0) continue;

        int client_fd = ::accept(server_fd, nullptr, nullptr);
        if (client_fd < 0) continue;

        // Read request (newline-delimited)
        char buf[4096] = {};
        ssize_t n = ::recv(client_fd, buf, sizeof(buf) - 1, 0);
        if (n > 0) {
            std::string request(buf, n);
            std::string response = handle_request(request) + "\n";
            ::send(client_fd, response.data(), response.size(), 0);
        }
        ::close(client_fd);
    }

    ::close(server_fd);
    ::unlink(socket_path_.c_str());
    std::cerr << "[license] Daemon stopped\n";
}

} // namespace svx
