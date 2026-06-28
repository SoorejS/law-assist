"""
Python client for the C++ license daemon.
Communicates via Unix socket (same machine, negligible latency).

In LICENSE_ENABLED=false mode (development/trial), all calls pass through
as if the license is valid — no daemon needed.
"""

from __future__ import annotations
import socket
import json
import time
from functools import lru_cache
import config


class LicenseError(Exception):
    pass


def _send(payload: dict) -> dict:
    """Send a JSON request to the license daemon and return the response."""
    sock_path = config.LICENSE_DAEMON_SOCKET
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
            s.settimeout(2.0)
            s.connect(sock_path)
            s.sendall((json.dumps(payload) + "\n").encode())
            data = b""
            while True:
                chunk = s.recv(4096)
                if not chunk:
                    break
                data += chunk
                if data.endswith(b"\n"):
                    break
            return json.loads(data.decode().strip())
    except (FileNotFoundError, ConnectionRefusedError):
        raise LicenseError(
            f"License daemon not running at {sock_path}. "
            "Start it with: ./saravonix-license"
        )
    except Exception as e:
        raise LicenseError(f"License daemon error: {e}")


def _dev_mode_response(action: str, **kwargs) -> dict:
    """Stub response for development / LICENSE_ENABLED=false."""
    if action == "validate":
        return {
            "status": "VALID",
            "customer_id": "DEV",
            "customer_name": "Development Mode",
            "seat_count": 20,
            "cloud_enabled": True,
            "vertical": config.VERTICAL,
            "sarvam_tier": "pravah_pro",
            "days_remaining": 9999,
            "fingerprint": "dev_fingerprint",
        }
    if action == "check_seat":
        return {"allowed": True, "seats_used": 1, "seats_total": 20}
    if action == "release_seat":
        return {"ok": True}
    if action == "sign_cloud":
        return {
            "signature": "dev_signature",
            "license_prefix": "DEV*****",
            "customer_id": "DEV",
        }
    if action == "fingerprint":
        return {"fingerprint": "dev_fingerprint", "mac": "00:00:00:00:00:00", "machine": "dev"}
    return {"error": "unknown_action"}


def _call(action: str, **kwargs) -> dict:
    if not config.LICENSE_ENABLED:
        return _dev_mode_response(action, **kwargs)
    payload = {"action": action, **kwargs}
    return _send(payload)


# ── Public API ─────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _cached_validate():
    """Cache validation result for 60s to avoid hammering the daemon."""
    return _call("validate"), time.time()


def validate() -> dict:
    """Validate the license. Returns the daemon response dict."""
    result, ts = _cached_validate()
    if time.time() - ts > 60:
        _cached_validate.cache_clear()
        result, ts = _cached_validate()
    return result


def is_valid() -> bool:
    try:
        return validate().get("status") == "VALID"
    except LicenseError:
        return False


def cloud_enabled() -> bool:
    try:
        info = validate()
        return info.get("status") == "VALID" and info.get("cloud_enabled", False)
    except LicenseError:
        return False


def check_seat(session_id: str) -> bool:
    try:
        result = _call("check_seat", session_id=session_id)
        return result.get("allowed", False)
    except LicenseError:
        return False


def release_seat(session_id: str) -> None:
    try:
        _call("release_seat", session_id=session_id)
    except LicenseError:
        pass  # Best-effort


def sign_cloud_request(payload: str) -> dict:
    """Sign a cloud escalation request. Called before routing to Sarvam/Claude."""
    if not config.LICENSE_ENABLED:
        return _dev_mode_response("sign_cloud", payload=payload)
    result = _call("sign_cloud", payload=payload)
    if "error" in result:
        raise LicenseError(f"Cannot sign cloud request: {result['error']}")
    return result


def get_fingerprint() -> str:
    try:
        return _call("fingerprint").get("fingerprint", "unknown")
    except LicenseError:
        return "unknown"


def get_info() -> dict:
    """Return full license info for display in the UI."""
    try:
        info = validate()
        info["license_enabled"] = config.LICENSE_ENABLED
        return info
    except LicenseError as e:
        return {"status": "DAEMON_OFFLINE", "error": str(e), "license_enabled": config.LICENSE_ENABLED}
