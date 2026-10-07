"""
Privacy Filter — Off-line PII & Confidential Data Sanitizer for Cloud Escalation.

Ensures that even if a user manually escalates a prompt to a cloud LLM
(Sarvam or Anthropic), sensitive identifiers (PAN, GSTIN, Aadhaar, Phone, Email)
are automatically sanitized locally before leaving the machine.
"""

from __future__ import annotations
import re

PATTERNS = [
    # GSTIN: 22AAAAA0000A1Z5
    (re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b", re.IGNORECASE), "[REDACTED_GSTIN]"),
    
    # PAN Number: ABCDE1234F
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]{1}\b", re.IGNORECASE), "[REDACTED_PAN]"),
    
    # Aadhaar Number: 1234 5678 9012
    (re.compile(r"\b\d{4}[\s-]\d{4}[\s-]\d{4}\b"), "[REDACTED_AADHAAR]"),
    
    # Indian Phone Numbers: +91 9876543210, 9876543210
    (re.compile(r"\b(?:\+91[\s-]?)?[6-9]\d{9}\b"), "[REDACTED_PHONE]"),
    
    # Email addresses
    (re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b"), "[REDACTED_EMAIL]"),
]


def sanitize_text(text: str) -> str:
    """Sanitizes sensitive identifiers from input text."""
    if not text:
        return text
    result = text
    for pattern, replacement in PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def has_pii(text: str) -> bool:
    """Checks whether any sensitive PII identifiers are detected in text."""
    if not text:
        return False
    for pattern, _ in PATTERNS:
        if pattern.search(text):
            return True
    return False


def filter_text(text: str) -> tuple[str, bool]:
    """Sanitizes text and returns (sanitized_text, has_pii_detected)."""
    detected = has_pii(text)
    return sanitize_text(text), detected

