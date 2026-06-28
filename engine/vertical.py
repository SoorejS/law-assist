"""
Vertical config loader — loads the YAML config for the active industry vertical.
"""

from __future__ import annotations
from pathlib import Path
from functools import lru_cache

import yaml
import config

_DEFAULT_SYSTEM_PROMPT = """You are a document assistant. Answer ONLY from the provided document excerpts.
Cite every fact with: [Source: filename, Page X].
If not found in excerpts, say: "I could not find that in your documents."
Do not use any knowledge outside these excerpts."""


@lru_cache(maxsize=1)
def load_vertical(vertical: str = None) -> dict:
    vertical = vertical or config.VERTICAL
    yaml_path = config.VERTICALS_DIR / f"{vertical}.yaml"
    if not yaml_path.exists():
        yaml_path = config.VERTICALS_DIR / "generic.yaml"
    with open(yaml_path, "r") as f:
        data = yaml.safe_load(f)
    return data


def get_system_prompt(vertical: str = None) -> str:
    v = load_vertical(vertical)
    return v.get("system_prompt", _DEFAULT_SYSTEM_PROMPT).strip()


def get_entity_label(vertical: str = None) -> str:
    return load_vertical(vertical).get("entity_label", "Folder")


def is_escalation_intent(query: str, vertical: str = None) -> bool:
    v = load_vertical(vertical)
    escalation_intents = v.get("escalation_intents", [])
    q_lower = query.lower()
    return any(intent.replace("_", " ") in q_lower for intent in escalation_intents)
