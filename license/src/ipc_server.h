#pragma once
#include "license_manager.h"
#include "hardware.h"
#include "crypto.h"
#include <string>
#include <atomic>
#include <set>
#include <mutex>

namespace svx {

class IpcServer {
public:
    IpcServer(const std::string& socket_path,
              const License& license,
              const HardwareId& hw,
              LicenseStatus status);

    void run();   // blocks; call from main thread
    void stop();  // signal shutdown (from signal handler)

private:
    std::string     socket_path_;
    License         license_;
    HardwareId      hw_;
    LicenseStatus   status_;
    std::atomic<bool> running_{true};

    std::set<std::string> active_sessions_;
    std::mutex sessions_mutex_;

    // Handle a single client connection; returns a JSON response string
    std::string handle_request(const std::string& json_request);

    bool check_seat(const std::string& session_id);
    void release_seat(const std::string& session_id);
};

} // namespace svx
