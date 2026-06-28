#include "hardware.h"
#include <openssl/sha.h>
#include <sstream>
#include <iomanip>
#include <cstring>

// Compile-time salt — bake into the binary so fingerprint can't be
// reproduced without the original binary.
static constexpr const char* SALT = "SVX-2026-SARAVONIX-LICENSE-SALT-v1";

// ── Platform-specific implementations ─────────────────────────────────────────

#if defined(__APPLE__)
  #include <sys/sysctl.h>
  #include <net/if.h>
  #include <net/if_dl.h>
  #include <ifaddrs.h>
  #include <IOKit/IOKitLib.h>

  static std::string get_mac() {
      struct ifaddrs *addrs = nullptr;
      if (getifaddrs(&addrs) != 0) return "00:00:00:00:00:00";
      std::string result = "00:00:00:00:00:00";
      for (auto *a = addrs; a; a = a->ifa_next) {
          if (!a->ifa_addr || a->ifa_addr->sa_family != AF_LINK) continue;
          std::string name(a->ifa_name);
          // Prefer en0 (primary ethernet/wifi)
          if (name == "en0" || (result == "00:00:00:00:00:00" && name.rfind("en", 0) == 0)) {
              auto *sdl = reinterpret_cast<struct sockaddr_dl *>(a->ifa_addr);
              auto *mac = reinterpret_cast<unsigned char *>(LLADDR(sdl));
              char buf[18];
              snprintf(buf, sizeof(buf), "%02x:%02x:%02x:%02x:%02x:%02x",
                       mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
              result = buf;
              if (name == "en0") break; // prefer en0 above all
          }
      }
      freeifaddrs(addrs);
      return result;
  }

  static std::string get_cpu() {
      char buf[256] = {};
      size_t len = sizeof(buf);
      sysctlbyname("machdep.cpu.brand_string", buf, &len, nullptr, 0);
      return std::string(buf);
  }

  static std::string get_machine_serial() {
      io_service_t expert = IOServiceGetMatchingService(
          kIOMainPortDefault,
          IOServiceMatching("IOPlatformExpertDevice"));
      if (!expert) return "UNKNOWN";
      auto *ref = static_cast<CFStringRef>(
          IORegistryEntryCreateCFProperty(expert,
              CFSTR(kIOPlatformSerialNumberKey),
              kCFAllocatorDefault, 0));
      IOObjectRelease(expert);
      if (!ref) return "UNKNOWN";
      char serial[64] = {};
      CFStringGetCString(ref, serial, sizeof(serial), kCFStringEncodingUTF8);
      CFRelease(ref);
      return std::string(serial);
  }

#elif defined(__linux__)
  #include <fstream>
  #include <net/if.h>
  #include <sys/ioctl.h>
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>

  static std::string get_mac() {
      int sock = socket(AF_INET, SOCK_DGRAM, 0);
      if (sock < 0) return "00:00:00:00:00:00";
      struct ifreq ifr;
      memset(&ifr, 0, sizeof(ifr));
      // Try common interface names
      for (const char *iface : {"eth0", "ens33", "enp0s3", "wlan0", "wlo1"}) {
          strncpy(ifr.ifr_name, iface, IFNAMSIZ - 1);
          if (ioctl(sock, SIOCGIFHWADDR, &ifr) == 0) {
              auto *mac = reinterpret_cast<unsigned char *>(ifr.ifr_hwaddr.sa_data);
              char buf[18];
              snprintf(buf, sizeof(buf), "%02x:%02x:%02x:%02x:%02x:%02x",
                       mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
              close(sock);
              return std::string(buf);
          }
      }
      close(sock);
      return "00:00:00:00:00:00";
  }

  static std::string get_cpu() {
      std::ifstream f("/proc/cpuinfo");
      std::string line;
      while (std::getline(f, line)) {
          if (line.rfind("model name", 0) == 0) {
              auto pos = line.find(':');
              if (pos != std::string::npos)
                  return line.substr(pos + 2);
          }
      }
      return "UNKNOWN";
  }

  static std::string get_machine_serial() {
      // Try DMI product serial, fall back to machine-id
      for (const char *path : {
          "/sys/class/dmi/id/product_serial",
          "/etc/machine-id",
          "/var/lib/dbus/machine-id"}) {
          std::ifstream f(path);
          std::string s;
          if (f && std::getline(f, s) && s.size() > 3) return s;
      }
      return "UNKNOWN";
  }

#else
  // Windows / unsupported — stub (implement with WMI in Phase 3)
  static std::string get_mac()            { return "00:00:00:00:00:00"; }
  static std::string get_cpu()            { return "UNKNOWN"; }
  static std::string get_machine_serial() { return "UNKNOWN"; }
#endif

// ── Public API ─────────────────────────────────────────────────────────────────

namespace svx {

std::string sha256_hex(const std::string& data) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char *>(data.data()),
           data.size(), hash);
    std::ostringstream ss;
    for (auto b : hash)
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(b);
    return ss.str();
}

HardwareId collect_hardware_id() {
    HardwareId hw;
    hw.mac     = get_mac();
    hw.cpu     = get_cpu();
    hw.machine = get_machine_serial();
    // Fingerprint includes salt so it can't be reproduced without our binary
    hw.fingerprint = sha256_hex(hw.mac + "|" + hw.cpu + "|" + hw.machine + "|" + SALT);
    return hw;
}

} // namespace svx
