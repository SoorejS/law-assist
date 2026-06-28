/**
 * License issuance tool — runs on SARAVONIX'S machine (not the customer's).
 *
 * Usage:
 *   ./issue-license \
 *     --customer-id  CUST_001 \
 *     --customer-name "Annamalai & Associates" \
 *     --fingerprint  <hw_fingerprint from customer's machine> \
 *     --seats        5 \
 *     --vertical     law_firm \
 *     --tier         pravah_basic \
 *     --days         365 \
 *     --out          license.dat
 *
 * The customer runs `saravonix-license fingerprint` on their machine to get
 * their HW fingerprint, sends it to Saravonix, and we issue the license.
 */

#include "../src/hardware.h"
#include "../src/crypto.h"
#include "../src/license_manager.h"
#include <iostream>
#include <string>
#include <ctime>
#include <sstream>
#include <iomanip>
#include <random>

static std::string generate_license_key(const std::string& customer_id) {
    // Format: SVX-XXXX-XXXX-XXXX-XXXX
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 35);
    const char *chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    std::ostringstream key;
    key << "SVX";
    for (int group = 0; group < 4; ++group) {
        key << "-";
        for (int i = 0; i < 4; ++i)
            key << chars[dis(gen)];
    }
    return key.str();
}

static std::string get_arg(int argc, char *argv[], const std::string& flag, const std::string& def = "") {
    for (int i = 1; i + 1 < argc; ++i)
        if (std::string(argv[i]) == flag) return argv[i + 1];
    return def;
}

int main(int argc, char *argv[]) {
    std::string customer_id   = get_arg(argc, argv, "--customer-id",   "CUST_001");
    std::string customer_name = get_arg(argc, argv, "--customer-name", "Customer");
    std::string fingerprint   = get_arg(argc, argv, "--fingerprint",   "");
    std::string seats_str     = get_arg(argc, argv, "--seats",         "1");
    std::string vertical      = get_arg(argc, argv, "--vertical",      "law_firm");
    std::string tier          = get_arg(argc, argv, "--tier",          "pravah_basic");
    std::string days_str      = get_arg(argc, argv, "--days",          "365");
    std::string out_path      = get_arg(argc, argv, "--out",           "license.dat");

    if (fingerprint.empty()) {
        std::cerr << "ERROR: --fingerprint is required.\n"
                  << "Ask the customer to run: saravonix-license fingerprint\n";
        return 1;
    }

    svx::License lic;
    lic.license_key   = generate_license_key(customer_id);
    lic.customer_id   = customer_id;
    lic.customer_name = customer_name;
    lic.fingerprint   = fingerprint;
    lic.seat_count    = std::stoi(seats_str);
    lic.cloud_enabled = true;
    lic.vertical      = vertical;
    lic.sarvam_tier   = tier;
    lic.issued_at     = std::time(nullptr);
    lic.expiry_epoch  = lic.issued_at + (std::stoll(days_str) * 86400LL);

    if (!svx::save_license(lic, out_path, fingerprint)) {
        std::cerr << "ERROR: Could not write license to " << out_path << "\n";
        return 1;
    }

    // Print summary
    std::time_t exp = lic.expiry_epoch;
    char exp_str[32] = {};
    struct tm *tm_info = localtime(&exp);
    strftime(exp_str, sizeof(exp_str), "%Y-%m-%d", tm_info);

    std::cout << "\n=== LICENSE ISSUED ===\n"
              << "Key:      " << lic.license_key << "\n"
              << "Customer: " << lic.customer_name << " (" << lic.customer_id << ")\n"
              << "Seats:    " << lic.seat_count << "\n"
              << "Vertical: " << lic.vertical << "\n"
              << "Tier:     " << lic.sarvam_tier << "\n"
              << "Expires:  " << exp_str << "\n"
              << "File:     " << out_path << "\n\n"
              << "Deliver " << out_path << " to the customer.\n"
              << "They place it in the engine/ directory and restart.\n";

    return 0;
}
