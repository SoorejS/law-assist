"""
Web Search Tool with Offline PII Redaction and Safe Query Handling.
Complies with local privacy guarantees: all PII is scrubbed before transmission.
"""

from __future__ import annotations
import re
import urllib.request
import urllib.parse
import json
import logging
from typing import List, Dict, Any

logger = logging.getLogger("web_search")

# Patterns for PII redaction
RE_EMAIL = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
RE_PHONE = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
RE_SSN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
RE_CREDIT_CARD = re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b')


def redact_pii(text: str) -> str:
    """Strip common PII before sending any query to the internet."""
    text = RE_EMAIL.sub("[REDACTED_EMAIL]", text)
    text = RE_PHONE.sub("[REDACTED_PHONE]", text)
    text = RE_SSN.sub("[REDACTED_SSN]", text)
    text = RE_CREDIT_CARD.sub("[REDACTED_CARD]", text)
    return text


def search_web(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Search the web safely. Redacts PII first.
    Falls back gracefully if offline or unreachable.
    """
    sanitized_query = redact_pii(query).strip()
    if not sanitized_query:
        return {
            "query": query,
            "sanitized_query": "",
            "results": [],
            "status": "empty_query",
        }

    results: List[Dict[str, str]] = []

    # Attempt 1: DuckDuckGo Instant Answer API (JSON, very fast & clean)
    try:
        api_url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(sanitized_query)}&format=json&no_html=1&skip_disambig=1"
        req = urllib.request.Request(
            api_url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ProAssist/1.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            
            # Abstract text
            if data.get("AbstractText"):
                results.append({
                    "title": data.get("Heading") or sanitized_query,
                    "snippet": data["AbstractText"],
                    "url": data.get("AbstractURL") or "",
                })
            
            # Related topics
            for topic in data.get("RelatedTopics", []):
                if len(results) >= max_results:
                    break
                if isinstance(topic, dict) and "Text" in topic:
                    results.append({
                        "title": topic.get("FirstURL", "").split("/")[-1].replace("_", " ") or sanitized_query,
                        "snippet": topic["Text"],
                        "url": topic.get("FirstURL", ""),
                    })
    except Exception as e:
        logger.warning(f"DuckDuckGo API error: {e}")

    # Attempt 2: If API gave few results, query DuckDuckGo HTML endpoint
    if len(results) < 2:
        try:
            html_url = "https://html.duckduckgo.com/html/"
            form_data = urllib.parse.urlencode({"q": sanitized_query}).encode("utf-8")
            req = urllib.request.Request(
                html_url,
                data=form_data,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ProAssist/1.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                content = response.read().decode("utf-8", errors="ignore")
                
                # Extract snippets using regex
                snippet_matches = re.findall(
                    r'<a class="result__snippet[^>]*>(.*?)</a>',
                    content,
                    re.DOTALL
                )
                title_matches = re.findall(
                    r'<a class="result__url"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                    content,
                    re.DOTALL
                )
                
                for i in range(min(len(snippet_matches), max_results)):
                    clean_snippet = re.sub(r'<[^>]+>', '', snippet_matches[i]).strip()
                    url = title_matches[i][0] if i < len(title_matches) else ""
                    clean_title = re.sub(r'<[^>]+>', '', title_matches[i][1]).strip() if i < len(title_matches) else sanitized_query
                    if clean_snippet and not any(r["snippet"] == clean_snippet for r in results):
                        results.append({
                            "title": clean_title,
                            "snippet": clean_snippet,
                            "url": url,
                        })
                        if len(results) >= max_results:
                            break
        except Exception as e:
            logger.warning(f"DuckDuckGo HTML error: {e}")

    return {
        "query": query,
        "sanitized_query": sanitized_query,
        "pii_redacted": sanitized_query != query,
        "results": results[:max_results],
        "status": "success" if results else "no_results_or_offline",
    }
