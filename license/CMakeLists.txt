cmake_minimum_required(VERSION 3.16)
project(saravonix_license VERSION 0.2.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type")

# ── Hardening flags ────────────────────────────────────────────────────────────
add_compile_options(
    -O2
    -fstack-protector-strong
    -D_FORTIFY_SOURCE=2
)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
    add_link_options(-Wl,-dead_strip)  # macOS / -Wl,--gc-sections on Linux
endif()

# ── OpenSSL (required) ─────────────────────────────────────────────────────────
find_package(OpenSSL REQUIRED)

# ── macOS: IOKit for hardware serial ──────────────────────────────────────────
if(APPLE)
    find_library(IOKIT_LIB IOKit REQUIRED)
    find_library(COREFOUNDATION_LIB CoreFoundation REQUIRED)
endif()

# ── Executable ────────────────────────────────────────────────────────────────
add_executable(saravonix-license
    src/main.cpp
    src/hardware.cpp
    src/crypto.cpp
    src/license_manager.cpp
    src/ipc_server.cpp
)

target_include_directories(saravonix-license PRIVATE src)
target_link_libraries(saravonix-license OpenSSL::Crypto)

if(APPLE)
    target_link_libraries(saravonix-license ${IOKIT_LIB} ${COREFOUNDATION_LIB})
endif()

if(WIN32)
    target_link_libraries(saravonix-license ws2_32)
endif()

# Strip symbols in release builds (makes reverse engineering harder)
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(APPLE)
        add_custom_command(TARGET saravonix-license POST_BUILD
            COMMAND strip -x $<TARGET_FILE:saravonix-license>)
    elseif(UNIX)
        add_custom_command(TARGET saravonix-license POST_BUILD
            COMMAND strip --strip-all $<TARGET_FILE:saravonix-license>)
    endif()
endif()

install(TARGETS saravonix-license DESTINATION bin)

# ── Activation tool (separate — runs on Saravonix's server to issue licenses) ─
# Built separately: cmake -DBUILD_TOOLS=ON ..
option(BUILD_TOOLS "Build license issuance tools" OFF)
if(BUILD_TOOLS)
    add_executable(issue-license tools/issue_license.cpp
        src/hardware.cpp src/crypto.cpp src/license_manager.cpp)
    target_include_directories(issue-license PRIVATE src)
    target_link_libraries(issue-license OpenSSL::Crypto)
    if(APPLE)
        target_link_libraries(issue-license ${IOKIT_LIB} ${COREFOUNDATION_LIB})
    endif()
endif()
