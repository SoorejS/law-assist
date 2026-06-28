/**
 * Saravonix License Daemon — v0.2
 *
 * IPC protocol (newline-delimited JSON over Unix socket):
 *
 *   {"action":"validate"}
 *     → {"status":"VALID","customer_id":"...","seat_count":5,...}
 *
 *   {"action":"check_seat","session_id":"user_abc"}
 *     → {"allowed":true,"seats_used":2,"seats_total":5}
 *
 *   {"action":"release_seat","session_id":"user_abc"}
 *     → {"ok":true}
 *
 *   {"action":"sign_cloud","payload":"..."}
 *     → {"signature":"HMAC_HEX","license_prefix":"SVX-XXXX****","customer_id":"..."}
 *
 *   {"action":"fingerprint"}
 *     → {"fingerprint":"sha256...","mac":"xx:xx:...","machine":"..."}
 *
 * Build:
 *   cd license && mkdir -p build && cd build
 *   cmake .. -DCMAKE_BUILD_TYPE=Release && make -j4
 *
 * Run:
 *   ./saravonix-license [socket_path] [license_file]
 */

#include "hardware.h"
#include "license_manager.h"
#include "ipc_server.h"
#include <iostream>
#include <csignal>
#include <atomic>

static std::atomic<bool>   g_running{true};
static svx::IpcServer     *g_server = nullptr;

static void on_signal(int) {
    g_running = false;
    if (g_server) g_server->stop();
}

int main(int argc, char *argv[]) {
    std::signal(SIGINT,  on_signal);
    std::signal(SIGTERM, on_signal);

    std::string socket_path  = argc > 1 ? argv[1] : "/tmp/saravonix_license.sock";
    std::string license_path = argc > 2 ? argv[2] : "license.dat";

    // ── Collect hardware fingerprint ──────────────────────────────────────────
    auto hw = svx::collect_hardware_id();
    std::cerr << "[license] HW fingerprint: " << hw.fingerprint.substr(0, 16) << "...\n";
    std::cerr << "[license] MAC: " << hw.mac << "\n";

    // ── Load and validate license ─────────────────────────────────────────────
    svx::License lic;
    bool loaded = svx::load_license(lic, license_path, hw.fingerprint);
    svx::LicenseStatus status = svx::LicenseStatus::NOT_FOUND;

    if (loaded) {
        status = svx::validate_license(lic, hw.fingerprint);
        std::cerr << "[license] Status: " << svx::status_to_str(status) << "\n";
        if (status == svx::LicenseStatus::VALID) {
            std::cerr << "[license] Customer: " << lic.customer_name
                      << " | Seats: " << lic.seat_count
                      << " | Vertical: " << lic.vertical << "\n";
        }
    } else {
        std::cerr << "[license] No license file found at " << license_path
                  << ". Engine will run in trial mode (local only, no cloud).\n";
        // Trial mode: local features work, cloud is disabled
        lic.cloud_enabled = false;
        lic.seat_count    = 1;
        lic.customer_id   = "TRIAL";
        lic.customer_name = "Trial";
        lic.vertical      = "generic";
        lic.fingerprint   = hw.fingerprint;
    }

    // ── Start IPC daemon ──────────────────────────────────────────────────────
    svx::IpcServer server(socket_path, lic, hw, status);
    g_server = &server;
    server.run();  // blocks until stop() is called

    return 0;
}
