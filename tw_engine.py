"""
tw_engine.py — TraceWorks Free OSINT Investigation Engine
Tier-based investigation using only free, open-source tools.
No paid APIs. All public record sources.

Tiers:
  T1 - LOCATE:         WHOIS, DuckDuckGo, Wayback, People index
  T2 - OWNERSHIP:      T1 + CAD scrape, TX SOS, OpenCorporates, domain records
  T3 - PROBATE:        T2 + people search, obituary index, court index, heir scoring
  T4 - COMPREHENSIVE:  All modules + Common Crawl, username probe, deep entity graph

Usage:
  python tw_engine.py --tier T2 --subject "John Smith" --county harris --state TX
  python tw_engine.py --tier T4 --subject "123 Main St" --county harris --domain "smithco.com"

Dependencies (see requirements.txt):
  scrapy, playwright, requests, beautifulsoup4, trafilatura,
  python-whois, ipwhois, wayback-machine-downloader (CDX via requests),
  opencorporates API (free tier)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus, urlencode, urlparse

# ── third-party imports ───────────────────────────────────────────────────────
import requests
from bs4 import BeautifulSoup

try:
    import whois as python_whois
    WHOIS_AVAILABLE = True
except ImportError:
    WHOIS_AVAILABLE = False
    logging.warning("python-whois not installed; whois_lookup will fall back to RDAP only")

try:
    from ipwhois import IPWhois
    IPWHOIS_AVAILABLE = True
except ImportError:
    IPWHOIS_AVAILABLE = False
    logging.warning("ipwhois not installed; IP RDAP lookups disabled")

try:
    import trafilatura
    TRAFILATURA_AVAILABLE = True
except ImportError:
    TRAFILATURA_AVAILABLE = False
    logging.warning("trafilatura not installed; clean text extraction will be limited")

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logging.warning("playwright not installed; JS-heavy scraping unavailable")

# ── logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("tw_engine")

# ── constants ─────────────────────────────────────────────────────────────────
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "DNT": "1",
}
REQUEST_TIMEOUT = 14  # seconds

# ── tier → module mapping ─────────────────────────────────────────────────────
TIER_MODULES: dict[str, list[str]] = {
    "T1": [
        "whois_lookup",
        "duckduckgo_search",
        "wayback_lookup",
        "people_search_scraper",
    ],
    "T2": [
        "whois_lookup",
        "duckduckgo_search",
        "wayback_lookup",
        "texas_cad_scraper",
        "tx_sos_scraper",
        "opencorporates_search",
        "domain_records",
    ],
    "T3": [
        "texas_cad_scraper",
        "tx_sos_scraper",
        "tx_courts_playwright",
        "people_search_scraper",
        "obituary_search",
        "heir_scorer",
    ],
    "T4": [
        "whois_lookup",
        "duckduckgo_search",
        "wayback_lookup",
        "common_crawl_lookup",
        "texas_cad_scraper",
        "tx_sos_scraper",
        "tx_courts_playwright",
        "opencorporates_search",
        "people_search_scraper",
        "obituary_search",
        "username_probe",
        "email_harvester",
        "entity_network_graph",
        "heir_scorer",
    ],
}

# ── Texas CAD portal registry ─────────────────────────────────────────────────
CAD_URLS: dict[str, str] = {
    "harris":     "https://hcad.org/property-search/real-property/",
    "travis":     "https://www.traviscad.org/propertysearch/",
    "williamson": "https://www.wcad.org/online-property-search/",
    "bexar":      "https://www.bcad.org/clientdb/",
    "dallas":     "https://www.dallascad.org/SearchAddr.aspx",
    "tarrant":    "https://www.tad.org/tad_search/full_search.php",
    "collin":     "https://www.collincad.org/propertysearch/",
    "denton":     "https://www.dentoncad.com/property-search/",
    "montgomery": "https://mcad-tx.org/propertysearch/",
    "galveston":  "https://galvestoncad.org/PropertySearch/",
    "fort bend":  "https://www.fbcad.org/property-search/",
    "brazoria":   "https://www.brazoriacad.org/property-search/",
    "nueces":     "https://www.nuecescad.net/PropertySearch/",
    "el paso":    "https://www.epcad.org/propertysearch",
    "lubbock":    "https://lubbockcad.org/PropertySearch/",
}

# ── Sherlock-style site list ─────────────────────────────────────────────────
PROBE_SITES: list[dict[str, str]] = [
    {"name": "GitHub",      "url": "https://github.com/{username}",                    "indicator": "404"},
    {"name": "Twitter/X",   "url": "https://twitter.com/{username}",                   "indicator": "404"},
    {"name": "Instagram",   "url": "https://www.instagram.com/{username}/",            "indicator": "Page Not Found"},
    {"name": "Facebook",    "url": "https://www.facebook.com/{username}",              "indicator": "404"},
    {"name": "LinkedIn",    "url": "https://www.linkedin.com/in/{username}",           "indicator": "404"},
    {"name": "Reddit",      "url": "https://www.reddit.com/user/{username}",           "indicator": "404"},
    {"name": "TikTok",      "url": "https://www.tiktok.com/@{username}",               "indicator": "404"},
    {"name": "Pinterest",   "url": "https://www.pinterest.com/{username}/",            "indicator": "404"},
    {"name": "Tumblr",      "url": "https://www.tumblr.com/{username}",                "indicator": "404"},
    {"name": "Keybase",     "url": "https://keybase.io/{username}",                    "indicator": "404"},
    {"name": "HackerNews",  "url": "https://news.ycombinator.com/user?id={username}",  "indicator": "No such user"},
    {"name": "Medium",      "url": "https://medium.com/@{username}",                   "indicator": "404"},
    {"name": "GitLab",      "url": "https://gitlab.com/{username}",                    "indicator": "404"},
    {"name": "Mastodon",    "url": "https://mastodon.social/@{username}",              "indicator": "404"},
    {"name": "Patreon",     "url": "https://www.patreon.com/{username}",               "indicator": "404"},
    {"name": "SoundCloud",  "url": "https://soundcloud.com/{username}",                "indicator": "404"},
    {"name": "Twitch",      "url": "https://www.twitch.tv/{username}",                 "indicator": "404"},
    {"name": "YouTube",     "url": "https://www.youtube.com/@{username}",              "indicator": "404"},
    {"name": "Vimeo",       "url": "https://vimeo.com/{username}",                     "indicator": "404"},
    {"name": "Flickr",      "url": "https://www.flickr.com/people/{username}",         "indicator": "404"},
]

# ─────────────────────────────────────────────────────────────────────────────
# RESULT SCHEMA
# ─────────────────────────────────────────────────────────────────────────────

def make_result(
    source: str,
    status: str,
    confidence: str,
    results: list[Any] | None = None,
    evidence: list[Any] | None = None,
    errors: list[str] | None = None,
    source_url: str = "",
    queried_at: str | None = None,
) -> dict[str, Any]:
    """Build a standardised module result dict."""
    return {
        "source":     source,
        "status":     status,           # found | not_found | error | blocked | manual_review
        "confidence": confidence,       # confirmed | likely | possible | not_verified | unavailable
        "results":    results or [],
        "evidence":   evidence or [],
        "errors":     errors or [],
        "queried_at": queried_at or datetime.now(timezone.utc).isoformat(),
        "source_url": source_url,
    }


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 1 — WHOIS / RDAP
# ─────────────────────────────────────────────────────────────────────────────

def whois_lookup(domain_or_name: str) -> dict[str, Any]:
    """
    Perform WHOIS + RDAP lookup on a domain name or IP address.
    Uses python-whois for WHOIS text, rdap.org JSON API for structured data.
    Returns registrar, registrant, creation/expiry dates, nameservers.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    source_url = f"https://rdap.org/domain/{quote_plus(domain_or_name)}"
    results: list[dict] = []
    errors: list[str] = []

    # ── python-whois (text WHOIS) ──────────────────────────────────────────
    if WHOIS_AVAILABLE:
        try:
            w = python_whois.whois(domain_or_name)
            whois_data: dict[str, Any] = {
                "registrar":       str(w.registrar or ""),
                "registrant_name": str(w.name or ""),
                "registrant_org":  str(w.org or ""),
                "creation_date":   str(w.creation_date[0] if isinstance(w.creation_date, list) else w.creation_date or ""),
                "expiration_date": str(w.expiration_date[0] if isinstance(w.expiration_date, list) else w.expiration_date or ""),
                "updated_date":    str(w.updated_date[0] if isinstance(w.updated_date, list) else w.updated_date or ""),
                "name_servers":    list(w.name_servers or []),
                "status":          list(w.status) if isinstance(w.status, list) else [str(w.status or "")],
                "emails":          list(w.emails or []),
                "dnssec":          str(w.dnssec or ""),
                "source":          "whois_text",
            }
            results.append(whois_data)
        except Exception as exc:
            errors.append(f"python-whois error: {exc}")

    # ── RDAP JSON API (rdap.org) ───────────────────────────────────────────
    rdap_url = f"https://rdap.org/domain/{quote_plus(domain_or_name)}"
    try:
        resp = requests.get(
            rdap_url,
            headers={**DEFAULT_HEADERS, "Accept": "application/rdap+json,application/json"},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 200:
            j = resp.json()
            registrar = None
            registrant = None
            for entity in j.get("entities", []):
                roles = entity.get("roles", [])
                fn_entry = None
                vcard = entity.get("vcardArray", [])
                if len(vcard) >= 2:
                    fn_entry = next(
                        (f[3] for f in vcard[1] if isinstance(f, list) and len(f) >= 4 and f[0] == "fn"),
                        None,
                    )
                if "registrar" in roles:
                    registrar = fn_entry
                if "registrant" in roles:
                    registrant = fn_entry

            events = {e["eventAction"]: e["eventDate"] for e in j.get("events", []) if "eventAction" in e}
            rdap_data = {
                "domain":       j.get("ldhName", domain_or_name),
                "registrar":    registrar,
                "registrant":   registrant,
                "created":      events.get("registration"),
                "expires":      events.get("expiration"),
                "last_changed": events.get("last changed"),
                "status":       j.get("status", []),
                "nameservers":  [ns.get("ldhName") for ns in j.get("nameservers", []) if ns.get("ldhName")],
                "source":       "rdap_json",
            }
            results.append(rdap_data)
        elif resp.status_code == 429:
            errors.append("RDAP rate limited (HTTP 429)")
        else:
            errors.append(f"RDAP HTTP {resp.status_code}")
    except requests.Timeout:
        errors.append(f"RDAP timeout after {REQUEST_TIMEOUT}s")
    except Exception as exc:
        errors.append(f"RDAP error: {exc}")

    if not results:
        return make_result(
            source="whois_rdap",
            status="error",
            confidence="unavailable",
            errors=errors,
            source_url=rdap_url,
            queried_at=queried_at,
        )

    registrant_found = any(
        r.get("registrant") or r.get("registrant_name") or r.get("registrant_org")
        for r in results
    )
    return make_result(
        source="whois_rdap",
        status="found",
        confidence="likely" if registrant_found else "possible",
        results=results,
        evidence=[
            {
                "type":       "domain_registration",
                "label":      f"WHOIS/RDAP record for {domain_or_name}",
                "confidence": "likely" if registrant_found else "possible",
                "data":       results[0],
            }
        ],
        errors=errors,
        source_url=rdap_url,
        queried_at=queried_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 2 — WAYBACK MACHINE CDX API
# ─────────────────────────────────────────────────────────────────────────────

def wayback_lookup(query: str) -> dict[str, Any]:
    """
    Query Wayback Machine CDX API for historical snapshots of a URL/domain.
    Endpoint: http://web.archive.org/cdx/search/cdx
    Free, no authentication required.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    params = {
        "url":      f"{query}*",
        "output":   "json",
        "limit":    "15",
        "fl":       "timestamp,original,statuscode,mimetype,digest",
        "collapse": "urlkey",
    }
    cdx_url = f"http://web.archive.org/cdx/search/cdx?{urlencode(params)}"

    try:
        resp = requests.get(cdx_url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 429:
            return make_result(
                source="wayback_cdx",
                status="blocked",
                confidence="unavailable",
                errors=["Wayback CDX rate limited (HTTP 429)"],
                source_url=cdx_url,
                queried_at=queried_at,
            )
        if not resp.ok:
            return make_result(
                source="wayback_cdx",
                status="error",
                confidence="unavailable",
                errors=[f"HTTP {resp.status_code}"],
                source_url=cdx_url,
                queried_at=queried_at,
            )

        rows = resp.json()
        if not rows or len(rows) <= 1:
            return make_result(
                source="wayback_cdx",
                status="not_found",
                confidence="not_verified",
                source_url=cdx_url,
                queried_at=queried_at,
            )

        header, *data_rows = rows
        snapshots = []
        for row in data_rows:
            record = dict(zip(header, row))
            ts = record.get("timestamp", "")
            if ts and len(ts) >= 8:
                formatted = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}T{ts[8:10]}:{ts[10:12]}:{ts[12:14]}Z" if len(ts) >= 14 else ts
            else:
                formatted = ts
            snapshots.append({
                "timestamp":   formatted,
                "original":    record.get("original"),
                "status_code": record.get("statuscode"),
                "mimetype":    record.get("mimetype"),
                "wayback_url": f"https://web.archive.org/web/{record.get('timestamp', '')}/{record.get('original', '')}",
            })

        return make_result(
            source="wayback_cdx",
            status="found",
            confidence="confirmed",
            results=snapshots,
            evidence=[
                {
                    "type":       "historical_snapshot",
                    "label":      f"Wayback Machine — {len(snapshots)} snapshots found for {query}",
                    "confidence": "confirmed",
                    "data":       {"query": query, "snapshot_count": len(snapshots), "earliest": snapshots[-1] if snapshots else None, "latest": snapshots[0] if snapshots else None},
                }
            ],
            source_url=cdx_url,
            queried_at=queried_at,
        )

    except requests.Timeout:
        return make_result(
            source="wayback_cdx",
            status="error",
            confidence="unavailable",
            errors=[f"Timeout after {REQUEST_TIMEOUT}s"],
            source_url=cdx_url,
            queried_at=queried_at,
        )
    except Exception as exc:
        return make_result(
            source="wayback_cdx",
            status="error",
            confidence="unavailable",
            errors=[str(exc)],
            source_url=cdx_url,
            queried_at=queried_at,
        )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 3 — COMMON CRAWL INDEX API
# ─────────────────────────────────────────────────────────────────────────────

def common_crawl_lookup(query: str) -> dict[str, Any]:
    """
    Query the Common Crawl CDX Index API for crawled pages matching a URL/domain.
    Uses the CC-MAIN-2024-10 index (most recent stable). Free, no authentication.
    Endpoint: https://index.commoncrawl.org/CC-MAIN-2024-10-index
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    index_url = "https://index.commoncrawl.org/CC-MAIN-2024-10-index"
    params = {
        "url":    f"{query}*",
        "output": "json",
        "limit":  "10",
    }
    full_url = f"{index_url}?{urlencode(params)}"

    try:
        resp = requests.get(full_url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 404:
            return make_result(
                source="common_crawl",
                status="not_found",
                confidence="not_verified",
                source_url=full_url,
                queried_at=queried_at,
            )
        if not resp.ok:
            return make_result(
                source="common_crawl",
                status="error",
                confidence="unavailable",
                errors=[f"HTTP {resp.status_code}"],
                source_url=full_url,
                queried_at=queried_at,
            )

        # CC index returns NDJSON (one JSON object per line)
        records = []
        for line in resp.text.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue

        if not records:
            return make_result(
                source="common_crawl",
                status="not_found",
                confidence="not_verified",
                source_url=full_url,
                queried_at=queried_at,
            )

        hits = [
            {
                "url":         r.get("url"),
                "timestamp":   r.get("timestamp"),
                "status":      r.get("status"),
                "mime_type":   r.get("mime"),
                "languages":   r.get("languages"),
                "filename":    r.get("filename"),
                "offset":      r.get("offset"),
                "length":      r.get("length"),
            }
            for r in records
        ]

        return make_result(
            source="common_crawl",
            status="found",
            confidence="confirmed",
            results=hits,
            evidence=[
                {
                    "type":       "common_crawl_index",
                    "label":      f"Common Crawl — {len(hits)} indexed pages for {query}",
                    "confidence": "confirmed",
                    "data":       {"query": query, "count": len(hits)},
                }
            ],
            source_url=full_url,
            queried_at=queried_at,
        )

    except requests.Timeout:
        return make_result(
            source="common_crawl",
            status="error",
            confidence="unavailable",
            errors=[f"Timeout after {REQUEST_TIMEOUT}s"],
            source_url=full_url,
            queried_at=queried_at,
        )
    except Exception as exc:
        return make_result(
            source="common_crawl",
            status="error",
            confidence="unavailable",
            errors=[str(exc)],
            source_url=full_url,
            queried_at=queried_at,
        )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 4 — DUCKDUCKGO HTML SEARCH
# ─────────────────────────────────────────────────────────────────────────────

def duckduckgo_search(query: str) -> dict[str, Any]:
    """
    Scrape DuckDuckGo HTML results page (no API key required).
    Parses organic search results from the rendered HTML.
    Rate limit: gentle — adds 1s delay between calls.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    # Use DDG HTML endpoint — returns classic HTML results without JS
    ddg_url = "https://html.duckduckgo.com/html/"
    data = {"q": query, "b": "", "kl": "us-en"}

    try:
        resp = requests.post(
            ddg_url,
            data=data,
            headers={
                **DEFAULT_HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer":      "https://duckduckgo.com/",
            },
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 429:
            return make_result(
                source="duckduckgo_html",
                status="blocked",
                confidence="unavailable",
                errors=["DuckDuckGo rate limited (HTTP 429)"],
                source_url=ddg_url,
                queried_at=queried_at,
            )
        if not resp.ok:
            return make_result(
                source="duckduckgo_html",
                status="error",
                confidence="unavailable",
                errors=[f"HTTP {resp.status_code}"],
                source_url=ddg_url,
                queried_at=queried_at,
            )

        soup = BeautifulSoup(resp.text, "html.parser")
        results = []

        for result in soup.select(".result, .web-result"):
            title_el = result.select_one(".result__title, .result__a")
            url_el = result.select_one(".result__url, a[href]")
            snippet_el = result.select_one(".result__snippet")

            title   = title_el.get_text(strip=True) if title_el else ""
            url_raw = url_el.get("href", "") if url_el else ""
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            # DDG wraps URLs in a redirect — extract the real URL
            if "uddg=" in url_raw:
                from urllib.parse import parse_qs, urlparse as up
                qs = parse_qs(up(url_raw).query)
                url_raw = qs.get("uddg", [url_raw])[0]

            if title or url_raw:
                results.append({"title": title, "url": url_raw, "snippet": snippet})

        if not results:
            return make_result(
                source="duckduckgo_html",
                status="not_found",
                confidence="not_verified",
                source_url=ddg_url,
                queried_at=queried_at,
            )

        return make_result(
            source="duckduckgo_html",
            status="found",
            confidence="possible",
            results=results[:10],
            evidence=[
                {
                    "type":       "web_search_result",
                    "label":      r["title"],
                    "confidence": "possible",
                    "data":       r,
                }
                for r in results[:5]
            ],
            source_url=ddg_url,
            queried_at=queried_at,
        )

    except requests.Timeout:
        return make_result(
            source="duckduckgo_html",
            status="error",
            confidence="unavailable",
            errors=[f"Timeout after {REQUEST_TIMEOUT}s"],
            source_url=ddg_url,
            queried_at=queried_at,
        )
    except Exception as exc:
        return make_result(
            source="duckduckgo_html",
            status="error",
            confidence="unavailable",
            errors=[str(exc)],
            source_url=ddg_url,
            queried_at=queried_at,
        )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 5 — OPENCORPORATES API (free tier)
# ─────────────────────────────────────────────────────────────────────────────

def opencorporates_search(company_name: str, jurisdiction: str = "us_tx") -> dict[str, Any]:
    """
    Search OpenCorporates free API for company records.
    No API key required for basic searches (rate limited to ~20 req/min).
    Jurisdiction defaults to us_tx (Texas).
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    params = {
        "q":                 company_name,
        "jurisdiction_code": jurisdiction,
        "format":            "json",
    }
    api_url = f"https://api.opencorporates.com/v0.4/companies/search?{urlencode(params)}"

    try:
        resp = requests.get(api_url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 429:
            return make_result(
                source="opencorporates",
                status="blocked",
                confidence="unavailable",
                errors=["OpenCorporates rate limited (HTTP 429)"],
                source_url=api_url,
                queried_at=queried_at,
            )
        if not resp.ok:
            return make_result(
                source="opencorporates",
                status="error",
                confidence="unavailable",
                errors=[f"HTTP {resp.status_code}"],
                source_url=api_url,
                queried_at=queried_at,
            )

        data = resp.json()
        companies_raw = data.get("results", {}).get("companies", [])
        companies = []
        for c_wrap in companies_raw:
            c = c_wrap.get("company", c_wrap)
            companies.append({
                "name":              c.get("name"),
                "company_number":    c.get("company_number"),
                "jurisdiction_code": c.get("jurisdiction_code"),
                "incorporation_date": c.get("incorporation_date"),
                "dissolution_date":  c.get("dissolution_date"),
                "company_type":      c.get("company_type"),
                "current_status":    c.get("current_status"),
                "registered_address": c.get("registered_address", {}).get("in_full"),
                "agent_name":        c.get("agent_name"),
                "opencorporates_url": c.get("opencorporates_url"),
            })

        if not companies:
            return make_result(
                source="opencorporates",
                status="not_found",
                confidence="not_verified",
                source_url=api_url,
                queried_at=queried_at,
            )

        return make_result(
            source="opencorporates",
            status="found",
            confidence="likely" if len(companies) >= 2 else "possible",
            results=companies,
            evidence=[
                {
                    "type":       "corporate_registration",
                    "label":      f"{c['name']} ({c.get('company_type','')}) — {c.get('current_status','')}",
                    "confidence": "likely",
                    "data":       c,
                }
                for c in companies[:5]
            ],
            source_url=api_url,
            queried_at=queried_at,
        )

    except requests.Timeout:
        return make_result(
            source="opencorporates",
            status="error",
            confidence="unavailable",
            errors=[f"Timeout after {REQUEST_TIMEOUT}s"],
            source_url=api_url,
            queried_at=queried_at,
        )
    except Exception as exc:
        return make_result(
            source="opencorporates",
            status="error",
            confidence="unavailable",
            errors=[str(exc)],
            source_url=api_url,
            queried_at=queried_at,
        )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 6 — TEXAS CAD SCRAPER
# ─────────────────────────────────────────────────────────────────────────────

def texas_cad_scraper(county: str, query: str) -> dict[str, Any]:
    """
    Scrape Texas county CAD property records.
    Harris County has a JSON API (real data extraction).
    Other counties: portal availability check + manual review notice.
    Uses Playwright for JS-heavy portals when available.
    """
    queried_at   = datetime.now(timezone.utc).isoformat()
    county_lower = (county or "").lower().strip()
    cad_url      = CAD_URLS.get(county_lower, f"https://www.{county_lower}cad.org/")
    source_id    = f"{county_lower}_cad"
    label        = f"{county.title()} County Appraisal District"

    # Harris County — JSON API
    if county_lower == "harris":
        try:
            search_url = f"https://hcad.org/api/search?searchVal={quote_plus(query)}&searchCriteria=address"
            resp = requests.get(
                search_url,
                headers={**DEFAULT_HEADERS, "Accept": "application/json", "Referer": cad_url},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 429:
                return make_result(source=source_id, status="blocked", confidence="unavailable",
                                   errors=["Rate limited (HTTP 429)"], source_url=cad_url, queried_at=queried_at)
            if not resp.ok:
                return make_result(source=source_id, status="error", confidence="unavailable",
                                   errors=[f"HTTP {resp.status_code}"], source_url=cad_url, queried_at=queried_at)

            j = resp.json()
            props_raw = j.get("data", j) if isinstance(j, dict) else j
            props_raw = props_raw if isinstance(props_raw, list) else []

            if not props_raw:
                return make_result(source=source_id, status="not_found", confidence="not_verified",
                                   source_url=cad_url, queried_at=queried_at)

            props = [
                {
                    "parcel_id":      (p.get("acct") or p.get("account") or p.get("parcel_id") or "").strip(),
                    "owner_name":     (p.get("owner") or p.get("owner_name") or "").strip(),
                    "situs_address":  (p.get("situs") or p.get("address") or "").strip(),
                    "legal_desc":     (p.get("legal") or p.get("legal_description") or "").strip(),
                    "assessed_value": str(p.get("appraised_val") or p.get("assessed_value") or ""),
                    "tax_year":       str(p.get("tax_year") or ""),
                    "property_class": (p.get("state_class") or p.get("property_type") or "").strip(),
                }
                for p in props_raw[:5]
            ]
            return make_result(
                source=source_id,
                status="found",
                confidence="likely" if props else "possible",
                results=props,
                evidence=[
                    {
                        "type":       "property_record",
                        "label":      f"{p['situs_address']} — Owner: {p['owner_name']}",
                        "confidence": "likely",
                        "data":       p,
                    }
                    for p in props
                ],
                source_url=cad_url,
                queried_at=queried_at,
            )
        except Exception as exc:
            return make_result(source=source_id, status="error", confidence="unavailable",
                               errors=[str(exc)], source_url=cad_url, queried_at=queried_at)

    # Other TX counties — portal check + manual review
    try:
        probe = requests.get(cad_url, headers=DEFAULT_HEADERS, timeout=8)
        reachable = probe.ok
    except Exception:
        reachable = False

    detail = (
        f"SOURCE_REQUIRES_MANUAL_REVIEW — {label} portal {'is reachable' if reachable else 'could not be reached'} "
        f"but requires browser interaction to search. Access directly: {cad_url} — search for: \"{query}\""
    )
    return make_result(
        source=source_id,
        status="manual_review",
        confidence="unavailable",
        errors=[detail],
        source_url=cad_url,
        queried_at=queried_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 7 — TX SOS / COMPTROLLER ENTITY SEARCH
# ─────────────────────────────────────────────────────────────────────────────

def tx_sos_scraper(entity_name: str) -> dict[str, Any]:
    """
    Search TX Comptroller Certificate of Account (COA) portal for registered entities.
    URL: https://mycpa.cpa.state.tx.us/coa/
    Parses HTML result table.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    source_url = "https://mycpa.cpa.state.tx.us/coa/"
    search_url = (
        f"https://mycpa.cpa.state.tx.us/coa/cosearch.do"
        f"?action=NAMEONLY&firstchar=&name={quote_plus(entity_name)}&searchtype=NAME"
    )

    try:
        resp = requests.get(
            search_url,
            headers={**DEFAULT_HEADERS, "Referer": source_url},
            timeout=REQUEST_TIMEOUT,
        )
        if not resp.ok:
            return make_result(
                source="tx_sos",
                status="error",
                confidence="unavailable",
                errors=[f"HTTP {resp.status_code}"],
                source_url=source_url,
                queried_at=queried_at,
            )

        soup = BeautifulSoup(resp.text, "html.parser")
        entities = []
        for i, row in enumerate(soup.select("table tr")):
            if i == 0:
                continue  # skip header
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            name   = cells[0].get_text(strip=True)
            status = cells[1].get_text(strip=True)
            etype  = cells[2].get_text(strip=True)
            if name:
                entities.append({"entity_name": name, "status": status, "entity_type": etype})

        if not entities:
            return make_result(
                source="tx_sos",
                status="not_found",
                confidence="not_verified",
                source_url=source_url,
                queried_at=queried_at,
            )

        return make_result(
            source="tx_sos",
            status="found",
            confidence="likely" if len(entities) >= 2 else "possible",
            results=entities[:10],
            evidence=[
                {
                    "type":       "entity_registration",
                    "label":      f"{e['entity_name']} ({e['entity_type']}) — {e['status']}",
                    "confidence": "likely",
                    "data":       e,
                }
                for e in entities[:5]
            ],
            source_url=source_url,
            queried_at=queried_at,
        )

    except requests.Timeout:
        return make_result(source="tx_sos", status="error", confidence="unavailable",
                           errors=[f"Timeout after {REQUEST_TIMEOUT}s"], source_url=source_url, queried_at=queried_at)
    except Exception as exc:
        return make_result(source="tx_sos", status="error", confidence="unavailable",
                           errors=[str(exc)], source_url=source_url, queried_at=queried_at)


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 8 — TX COURTS ONLINE (Playwright async)
# ─────────────────────────────────────────────────────────────────────────────

async def tx_courts_playwright(name: str, county: str) -> dict[str, Any]:
    """
    Automate TX Courts Online using Playwright (async) to search for probate/civil cases.
    TX Courts requires browser session interaction — headless Chromium via Playwright.
    Falls back to manual_review notice if Playwright is unavailable.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    source_url = "https://publicaccess.courts.state.tx.us/"

    if not PLAYWRIGHT_AVAILABLE:
        return make_result(
            source="tx_courts_online",
            status="manual_review",
            confidence="unavailable",
            errors=[
                f"SOURCE_REQUIRES_MANUAL_REVIEW — Playwright not installed. "
                f"Install with: pip install playwright && playwright install chromium. "
                f"Search manually at {source_url} — party name: \"{name}\", county: \"{county}\""
            ],
            source_url=source_url,
            queried_at=queried_at,
        )

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=DEFAULT_HEADERS["User-Agent"],
                locale="en-US",
            )
            page = await context.new_page()

            # Navigate to TX Courts Online
            await page.goto(source_url, wait_until="networkidle", timeout=30000)

            # Accept disclaimer if present
            disclaimer_btn = page.locator("input[type='submit'][value*='Agree'], button:has-text('I Agree')")
            if await disclaimer_btn.count() > 0:
                await disclaimer_btn.first.click()
                await page.wait_for_load_state("networkidle")

            # Select county from dropdown
            county_select = page.locator("select[name*='county'], select[id*='county']")
            if await county_select.count() > 0:
                await county_select.first.select_option(label=county.title())

            # Fill party name field
            name_input = page.locator("input[name*='party'], input[name*='name'], input[id*='party']")
            if await name_input.count() > 0:
                await name_input.first.fill(name)

            # Submit search
            submit_btn = page.locator("input[type='submit'], button[type='submit']")
            if await submit_btn.count() > 0:
                await submit_btn.first.click()
                await page.wait_for_load_state("networkidle")

            # Parse results table
            content = await page.content()
            soup = BeautifulSoup(content, "html.parser")
            cases = []
            for row in soup.select("table tr"):
                cells = row.find_all("td")
                if len(cells) >= 4:
                    cases.append({
                        "case_number": cells[0].get_text(strip=True),
                        "style":       cells[1].get_text(strip=True),
                        "court":       cells[2].get_text(strip=True),
                        "filed_date":  cells[3].get_text(strip=True),
                    })

            await browser.close()

            if not cases:
                return make_result(
                    source="tx_courts_online",
                    status="not_found",
                    confidence="not_verified",
                    source_url=source_url,
                    queried_at=queried_at,
                )

            return make_result(
                source="tx_courts_online",
                status="found",
                confidence="likely",
                results=cases,
                evidence=[
                    {
                        "type":       "court_case",
                        "label":      f"Case {c['case_number']}: {c['style']}",
                        "confidence": "likely",
                        "data":       c,
                    }
                    for c in cases[:5]
                ],
                source_url=source_url,
                queried_at=queried_at,
            )

    except Exception as exc:
        return make_result(
            source="tx_courts_online",
            status="error",
            confidence="unavailable",
            errors=[f"Playwright automation error: {exc}"],
            source_url=source_url,
            queried_at=queried_at,
        )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 9 — PEOPLE SEARCH SCRAPER
# ─────────────────────────────────────────────────────────────────────────────

def people_search_scraper(first: str, last: str, state: str = "TX") -> dict[str, Any]:
    """
    Scrape TruePeopleSearch and FastPeopleSearch for person records.
    Both are free public-data aggregators. Returns combined, deduplicated results.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    all_people: list[dict] = []
    errors: list[str] = []
    sources_hit: list[str] = []

    # ── TruePeopleSearch ──────────────────────────────────────────────────
    tps_url = (
        f"https://www.truepeoplesearch.com/results"
        f"?name={quote_plus(f'{first} {last}')}&citystatezip={quote_plus(state)}"
    )
    try:
        resp = requests.get(
            tps_url,
            headers={**DEFAULT_HEADERS, "Referer": "https://www.truepeoplesearch.com/"},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.ok:
            soup = BeautifulSoup(resp.text, "html.parser")
            for card in list(soup.select(".card-summary, [data-link-to-details]"))[:5]:
                name = (card.select_one(".h4, h2, .name") or card).get_text(strip=True)
                addrs = [
                    el.get_text(strip=True)
                    for el in card.select(".content-value, .address, [class*='address']")
                    if re.search(r"\d{2,6}\s+\w", el.get_text(strip=True))
                ]
                phones = [
                    el.get_text(strip=True).replace(" ", "")
                    for el in card.select('[href^="tel:"], .phone, [class*="phone"]')
                    if len(re.sub(r"\D", "", el.get_text(strip=True))) == 10
                ]
                relatives = [
                    el.get_text(strip=True)
                    for el in card.select(".relative, [class*='relative']")[:5]
                    if len(el.get_text(strip=True)) > 3
                ]
                all_people.append({
                    "name":      name,
                    "addresses": addrs,
                    "phones":    phones,
                    "relatives": relatives,
                    "_source":   "truepeoplesearch",
                })
            sources_hit.append("truepeoplesearch")
        elif resp.status_code == 429:
            errors.append("TruePeopleSearch rate limited")
        else:
            errors.append(f"TruePeopleSearch HTTP {resp.status_code}")
    except Exception as exc:
        errors.append(f"TruePeopleSearch error: {exc}")

    # ── FastPeopleSearch ───────────────────────────────────────────────────
    fps_url = (
        f"https://www.fastpeoplesearch.com/name"
        f"/{quote_plus(first)}-{quote_plus(last)}_{state}"
    )
    try:
        resp = requests.get(
            fps_url,
            headers={**DEFAULT_HEADERS, "Referer": "https://www.fastpeoplesearch.com/"},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.ok:
            soup = BeautifulSoup(resp.text, "html.parser")
            for card in list(soup.select(".card, .result-card, [class*='card']"))[:5]:
                name = (card.select_one("h2, h3, .name, [class*='name']") or card).get_text(strip=True)
                addrs = [
                    el.get_text(strip=True)
                    for el in card.select(".address, [class*='addr']")
                    if re.search(r"\d+\s+\w", el.get_text(strip=True))
                ]
                phones = [
                    a.get_text(strip=True)
                    for a in card.select("a[href^='tel:']")
                    if len(re.sub(r"\D", "", a.get_text(strip=True))) == 10
                ]
                relatives = [
                    el.get_text(strip=True)
                    for el in card.select(".relative-name, .person-name")[:4]
                    if len(el.get_text(strip=True)) > 3
                ]
                all_people.append({
                    "name":      name,
                    "addresses": addrs,
                    "phones":    phones,
                    "relatives": relatives,
                    "_source":   "fastpeoplesearch",
                })
            sources_hit.append("fastpeoplesearch")
        elif resp.status_code == 429:
            errors.append("FastPeopleSearch rate limited")
        else:
            errors.append(f"FastPeopleSearch HTTP {resp.status_code}")
    except Exception as exc:
        errors.append(f"FastPeopleSearch error: {exc}")

    if not all_people:
        return make_result(
            source="people_search",
            status="not_found" if not errors else "error",
            confidence="not_verified",
            errors=errors,
            source_url=tps_url,
            queried_at=queried_at,
        )

    return make_result(
        source="people_search",
        status="found",
        confidence="likely" if len(all_people) >= 3 else "possible",
        results=all_people,
        evidence=[
            {
                "type":       "person_record",
                "label":      f"{p['name']} — {', '.join(p['addresses'][:1]) or 'no address'} [{p['_source']}]",
                "confidence": "possible",
                "data":       p,
            }
            for p in all_people[:5]
        ],
        errors=errors,
        source_url=tps_url,
        queried_at=queried_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 10 — OBITUARY SEARCH
# ─────────────────────────────────────────────────────────────────────────────

def obituary_search(name: str, county: str) -> dict[str, Any]:
    """
    Search obituary indexes using DuckDuckGo HTML scrape + direct legacy.com scrape.
    Combines signals from both sources.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    query = f'"{name}" obituary {county} Texas'
    legacy_url = (
        f"https://www.legacy.com/obituaries/search"
        f"?keyword={quote_plus(name)}&location={quote_plus(f'{county}, TX')}"
    )
    results: list[dict] = []
    errors: list[str] = []

    # ── DuckDuckGo obituary search ────────────────────────────────────────
    ddg_result = duckduckgo_search(query)
    if ddg_result["status"] == "found":
        for r in ddg_result["results"]:
            if any(kw in (r.get("url", "") + r.get("title", "")).lower()
                   for kw in ("obituary", "obit", "legacy", "findagrave", "death", "passed")):
                results.append({**r, "_source": "duckduckgo_obit"})
    elif ddg_result["status"] == "error":
        errors.extend(ddg_result.get("errors", []))

    # ── Legacy.com direct scrape ───────────────────────────────────────────
    try:
        resp = requests.get(
            legacy_url,
            headers={**DEFAULT_HEADERS, "Referer": "https://www.legacy.com/"},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.ok:
            soup = BeautifulSoup(resp.text, "html.parser")
            for obit in soup.select(".obit-result, .obituary-result, [class*='obit'], article")[:5]:
                title_el = obit.select_one("h2, h3, .name, a")
                link_el  = obit.select_one("a[href]")
                desc_el  = obit.select_one("p, .snippet, .dates")
                o_title  = title_el.get_text(strip=True) if title_el else name
                o_url    = link_el.get("href", "") if link_el else legacy_url
                o_desc   = desc_el.get_text(strip=True) if desc_el else ""
                if not o_url.startswith("http"):
                    o_url = f"https://www.legacy.com{o_url}"
                results.append({"title": o_title, "url": o_url, "snippet": o_desc, "_source": "legacy_com"})
        else:
            errors.append(f"Legacy.com HTTP {resp.status_code}")
    except Exception as exc:
        errors.append(f"Legacy.com error: {exc}")

    if not results:
        return make_result(
            source="obituary_search",
            status="not_found",
            confidence="not_verified",
            errors=errors + [f"No obituary results found for \"{name}\" in {county}, TX. Manual search: legacy.com, findagrave.com"],
            source_url=legacy_url,
            queried_at=queried_at,
        )

    return make_result(
        source="obituary_search",
        status="found",
        confidence="possible",
        results=results,
        evidence=[
            {
                "type":       "obituary_record",
                "label":      r["title"],
                "confidence": "possible",
                "data":       r,
            }
            for r in results[:5]
        ],
        errors=errors,
        source_url=legacy_url,
        queried_at=queried_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 11 — USERNAME PROBE (Sherlock-style)
# ─────────────────────────────────────────────────────────────────────────────

def username_probe(name: str) -> dict[str, Any]:
    """
    Sherlock-style username enumeration across social/public platforms.
    Generates name variants (firstname, firstnamelast, first.last, etc.)
    and probes each site in PROBE_SITES list.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    parts  = name.lower().split()
    first  = parts[0] if parts else name.lower()
    last   = parts[-1] if len(parts) > 1 else ""

    # Generate username variants
    variants = list(dict.fromkeys(filter(None, [
        first,
        f"{first}{last}" if last else None,
        f"{first}.{last}" if last else None,
        f"{first}_{last}" if last else None,
        f"{first[0]}{last}" if last else None,
        name.lower().replace(" ", ""),
        name.lower().replace(" ", "_"),
        name.lower().replace(" ", "."),
    ])))

    found_profiles: list[dict] = []
    checked: list[dict] = []

    for username in variants[:4]:  # limit variants to avoid hammering
        for site in PROBE_SITES:
            url = site["url"].format(username=username)
            try:
                resp = requests.get(
                    url,
                    headers={**DEFAULT_HEADERS, "Referer": f"https://{urlparse(url).netloc}/"},
                    timeout=8,
                    allow_redirects=True,
                )
                not_found_indicator = site.get("indicator", "404")
                # Determine if profile exists
                exists = (
                    resp.ok
                    and str(resp.status_code) != "404"
                    and not_found_indicator not in resp.text
                )
                record = {
                    "platform":     site["name"],
                    "username":     username,
                    "url":          url,
                    "status_code":  resp.status_code,
                    "exists":       exists,
                }
                checked.append(record)
                if exists:
                    found_profiles.append(record)
            except Exception as exc:
                checked.append({
                    "platform": site["name"],
                    "username": username,
                    "url":      url,
                    "error":    str(exc),
                    "exists":   False,
                })
            time.sleep(0.15)  # gentle throttle

    if not found_profiles:
        return make_result(
            source="username_probe",
            status="not_found",
            confidence="not_verified",
            results=checked,
            source_url="",
            queried_at=queried_at,
        )

    return make_result(
        source="username_probe",
        status="found",
        confidence="possible",
        results=found_profiles,
        evidence=[
            {
                "type":       "social_profile",
                "label":      f"{p['platform']}: {p['url']}",
                "confidence": "possible",
                "data":       p,
            }
            for p in found_profiles[:10]
        ],
        source_url="",
        queried_at=queried_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 12 — EMAIL HARVESTER (theHarvester-style)
# ─────────────────────────────────────────────────────────────────────────────

def email_harvester(domain: str) -> dict[str, Any]:
    """
    theHarvester-style email/name extraction from public web pages.
    Scrapes contact, about, team, and staff pages for email patterns.
    Also queries DuckDuckGo for email addresses associated with the domain.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    email_re   = re.compile(r"[a-zA-Z0-9._%+\-]+@" + re.escape(domain.lstrip("www.").split(".")[0]) + r"[a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}")
    generic_re = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

    found_emails: set[str] = set()
    errors: list[str] = []
    pages_scraped: list[str] = []

    # Contact/about page variants to try
    paths_to_try = ["", "/contact", "/contact-us", "/about", "/about-us", "/team", "/staff", "/people"]
    base = f"https://{domain}" if not domain.startswith("http") else domain

    for path in paths_to_try[:5]:
        url = base + path
        try:
            resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=10, allow_redirects=True)
            if resp.ok:
                text = resp.text
                # Use trafilatura for clean text extraction if available
                if TRAFILATURA_AVAILABLE:
                    clean_text = trafilatura.extract(text) or text
                else:
                    soup = BeautifulSoup(text, "html.parser")
                    clean_text = soup.get_text(" ", strip=True)

                emails_on_page = set(generic_re.findall(clean_text))
                # Filter to domain-relevant emails
                domain_root = domain.lstrip("www.").split(".")[0].lower()
                for e in emails_on_page:
                    if domain_root in e.lower() or "@" + domain.lstrip("www.") in e.lower():
                        found_emails.add(e.lower())
                    elif found_emails.__len__() < 3:
                        found_emails.add(e.lower())
                pages_scraped.append(url)
        except Exception as exc:
            errors.append(f"{url}: {exc}")
        time.sleep(0.2)

    # Also query DuckDuckGo for email associations
    ddg_result = duckduckgo_search(f"site:{domain} email contact")
    for r in ddg_result.get("results", []):
        snippet = r.get("snippet", "") + " " + r.get("title", "")
        for e in generic_re.findall(snippet):
            if domain.lstrip("www.").split(".")[0] in e.lower():
                found_emails.add(e.lower())

    if not found_emails:
        return make_result(
            source="email_harvester",
            status="not_found",
            confidence="not_verified",
            errors=errors,
            source_url=base,
            queried_at=queried_at,
        )

    email_list = sorted(found_emails)
    return make_result(
        source="email_harvester",
        status="found",
        confidence="possible",
        results=[{"email": e} for e in email_list],
        evidence=[
            {
                "type":       "email_address",
                "label":      e,
                "confidence": "possible",
                "data":       {"email": e, "domain": domain},
            }
            for e in email_list[:10]
        ],
        errors=errors,
        source_url=base,
        queried_at=queried_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 13 — ENTITY NETWORK GRAPH (Recon-ng style cross-correlation)
# ─────────────────────────────────────────────────────────────────────────────

def entity_network_graph(entity_name: str) -> dict[str, Any]:
    """
    Recon-ng style entity enrichment and cross-correlation.
    Cross-links entities found across all available sources:
      - OpenCorporates company records
      - TX SOS registrations
      - WHOIS registrant names
      - DuckDuckGo co-mentions
      - Wayback snapshots
    Builds a graph of connected entities (people, companies, addresses, domains).
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    nodes: list[dict] = []
    edges: list[dict] = []
    errors: list[str] = []

    # Central node
    nodes.append({"id": entity_name, "type": "subject", "label": entity_name})

    # ── OpenCorporates lookup ─────────────────────────────────────────────
    oc_result = opencorporates_search(entity_name)
    if oc_result["status"] == "found":
        for c in oc_result["results"][:5]:
            c_id = c.get("name", "")
            if c_id and c_id != entity_name:
                nodes.append({"id": c_id, "type": "company", "label": c_id,
                               "data": {"number": c.get("company_number"), "status": c.get("current_status")}})
                edges.append({"from": entity_name, "to": c_id, "relation": "opencorporates_match"})
            # Add registered address as node
            addr = c.get("registered_address")
            if addr:
                nodes.append({"id": addr, "type": "address", "label": addr})
                edges.append({"from": c_id or entity_name, "to": addr, "relation": "registered_at"})

    # ── TX SOS lookup ─────────────────────────────────────────────────────
    sos_result = tx_sos_scraper(entity_name)
    if sos_result["status"] == "found":
        for e in sos_result["results"][:5]:
            e_id = e.get("entity_name", "")
            if e_id and e_id != entity_name:
                nodes.append({"id": e_id, "type": "tx_entity", "label": e_id,
                               "data": {"type": e.get("entity_type"), "status": e.get("status")}})
                edges.append({"from": entity_name, "to": e_id, "relation": "tx_sos_match"})

    # ── WHOIS / domain association ────────────────────────────────────────
    # Derive possible domains from entity name
    domain_guess = re.sub(r"\s+", "", entity_name.lower().replace(",", "").replace(".", "")) + ".com"
    whois_result = whois_lookup(domain_guess)
    if whois_result["status"] == "found":
        nodes.append({"id": domain_guess, "type": "domain", "label": domain_guess})
        edges.append({"from": entity_name, "to": domain_guess, "relation": "possible_domain"})
        for r in whois_result["results"]:
            registrant = r.get("registrant") or r.get("registrant_name") or r.get("registrant_org")
            if registrant and registrant != entity_name:
                nodes.append({"id": registrant, "type": "person_or_org", "label": registrant})
                edges.append({"from": domain_guess, "to": registrant, "relation": "registrant"})

    # ── DuckDuckGo co-mentions ────────────────────────────────────────────
    ddg_result = duckduckgo_search(f'"{entity_name}" Texas company LLC corporation')
    if ddg_result["status"] == "found":
        for r in ddg_result["results"][:5]:
            nodes.append({
                "id":    r["url"],
                "type":  "web_mention",
                "label": r.get("title", r["url"]),
                "data":  {"url": r["url"], "snippet": r.get("snippet", "")},
            })
            edges.append({"from": entity_name, "to": r["url"], "relation": "mentioned_on"})

    return make_result(
        source="entity_network_graph",
        status="found" if nodes else "not_found",
        confidence="possible",
        results={"nodes": nodes, "edges": edges},
        evidence=[
            {
                "type":       "entity_graph",
                "label":      f"Entity network for {entity_name}: {len(nodes)} nodes, {len(edges)} edges",
                "confidence": "possible",
                "data":       {"node_count": len(nodes), "edge_count": len(edges)},
            }
        ],
        errors=errors,
        source_url="",
        queried_at=queried_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 14 — HEIR SCORER (pure logic)
# ─────────────────────────────────────────────────────────────────────────────

def heir_scorer(candidates: list[dict], subject_last_name: str) -> dict[str, Any]:
    """
    Pure logic scoring of heir candidates based on last name match,
    address availability, phone availability, and relative associations.
    No HTTP calls. Returns scored and ranked candidates.

    Scoring rubric:
      +3  last name matches subject
      +2  has known addresses
      +1  has phone number(s)
      +1  has listed relatives
      +1  single address (more specific = more likely)
      -1  no contact info at all
    """
    queried_at = datetime.now(timezone.utc).isoformat()

    if not candidates:
        return make_result(
            source="heir_scorer",
            status="not_found",
            confidence="not_verified",
            queried_at=queried_at,
        )

    scored = []
    for c in candidates:
        score = 0
        name = (c.get("name") or "").upper()
        last_upper = subject_last_name.upper()

        if last_upper and last_upper in name:
            score += 3
        if c.get("addresses"):
            score += 2
            if len(c["addresses"]) == 1:
                score += 1
        if c.get("phones"):
            score += 1
        if c.get("relatives"):
            score += 1
        if not c.get("addresses") and not c.get("phones"):
            score -= 1

        if score >= 6:
            rating     = "probable_heir"
            confidence = "likely"
        elif score >= 3:
            rating     = "possible_heir"
            confidence = "possible"
        else:
            rating     = "low_confidence"
            confidence = "not_verified"

        scored.append({**c, "heir_rating": rating, "heir_score": score, "confidence": confidence})

    scored.sort(key=lambda x: x["heir_score"], reverse=True)

    return make_result(
        source="heir_scorer",
        status="found",
        confidence="possible",
        results=scored,
        evidence=[
            {
                "type":       "heir_candidate",
                "label":      f"{c.get('name', 'Unknown')} — {c['heir_rating']} (score {c['heir_score']})",
                "confidence": c["confidence"],
                "data":       c,
            }
            for c in scored[:5]
        ],
        queried_at=queried_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# TIER DISPATCHER
# ─────────────────────────────────────────────────────────────────────────────

def run_tier(
    tier: str,
    subject: str,
    county: str | None = None,
    state: str = "TX",
    domain: str | None = None,
) -> dict[str, Any]:
    """
    Dispatch investigation modules based on tier.
    Returns a consolidated investigation report.

    Args:
        tier:    T1 | T2 | T3 | T4
        subject: Person name, company name, or property address
        county:  Texas county name (e.g., 'harris', 'travis')
        state:   US state abbreviation (default TX)
        domain:  Domain name to investigate (optional)

    Returns:
        Investigation report dict with per-module results and summary.
    """
    tier = tier.upper()
    if tier not in TIER_MODULES:
        return {
            "error":          f"Invalid tier: {tier}. Valid tiers: {list(TIER_MODULES.keys())}",
            "tier":           tier,
            "subject":        subject,
            "started_at":     datetime.now(timezone.utc).isoformat(),
            "module_results": {},
        }

    modules = TIER_MODULES[tier]
    started_at = datetime.now(timezone.utc).isoformat()
    log.info(f"[{tier}] Starting investigation for subject: {subject!r}")
    log.info(f"[{tier}] Modules: {', '.join(modules)}")

    module_results: dict[str, Any] = {}
    name_parts = subject.split()
    first = name_parts[0] if name_parts else subject
    last  = name_parts[-1] if len(name_parts) > 1 else ""

    # Run synchronous modules
    for mod in modules:
        log.info(f"[{tier}] Running: {mod}")

        if mod == "whois_lookup":
            tgt = domain or f"{subject.lower().replace(' ', '')}.com"
            module_results[mod] = whois_lookup(tgt)

        elif mod == "duckduckgo_search":
            module_results[mod] = duckduckgo_search(f"{subject} {county or ''} {state} property owner records")

        elif mod == "wayback_lookup":
            tgt = domain or f"{subject.lower().replace(' ', '')}.com"
            module_results[mod] = wayback_lookup(tgt)

        elif mod == "common_crawl_lookup":
            tgt = domain or subject
            module_results[mod] = common_crawl_lookup(tgt)

        elif mod == "texas_cad_scraper":
            if county:
                module_results[mod] = texas_cad_scraper(county, subject)
            else:
                module_results[mod] = make_result(
                    source="texas_cad_scraper",
                    status="error",
                    confidence="unavailable",
                    errors=["County required for CAD scraper"],
                )

        elif mod == "tx_sos_scraper":
            module_results[mod] = tx_sos_scraper(subject)

        elif mod == "tx_courts_playwright":
            # Run async in sync context
            module_results[mod] = asyncio.run(tx_courts_playwright(subject, county or "Harris"))

        elif mod == "opencorporates_search":
            module_results[mod] = opencorporates_search(subject)

        elif mod == "people_search_scraper":
            module_results[mod] = people_search_scraper(first, last, state)

        elif mod == "obituary_search":
            module_results[mod] = obituary_search(subject, county or "Harris")

        elif mod == "username_probe":
            module_results[mod] = username_probe(subject)

        elif mod == "email_harvester":
            tgt = domain or f"{subject.lower().replace(' ', '')}.com"
            module_results[mod] = email_harvester(tgt)

        elif mod == "entity_network_graph":
            module_results[mod] = entity_network_graph(subject)

        elif mod == "heir_scorer":
            # Collect people candidates from earlier results
            candidates: list[dict] = []
            for src in ["people_search_scraper", "people_search"]:
                if src in module_results and module_results[src].get("status") == "found":
                    candidates.extend(module_results[src].get("results", []))
            module_results[mod] = heir_scorer(candidates, last or subject)

        elif mod == "domain_records":
            tgt = domain or f"{subject.lower().replace(' ', '')}.com"
            # Use whois + wayback as domain record proxy
            w = whois_lookup(tgt)
            wb = wayback_lookup(tgt)
            module_results[mod] = {
                "source":     "domain_records",
                "status":     "found" if w["status"] == "found" else "not_found",
                "confidence": w["confidence"],
                "results":    w["results"] + wb["results"],
                "evidence":   w["evidence"] + wb["evidence"],
                "errors":     w["errors"] + wb["errors"],
                "queried_at": datetime.now(timezone.utc).isoformat(),
                "source_url": w["source_url"],
            }

        else:
            log.warning(f"[{tier}] Unknown module: {mod} — skipping")

    # Summary
    found_count = sum(1 for r in module_results.values() if r.get("status") == "found")
    error_count = sum(1 for r in module_results.values() if r.get("status") in ("error", "blocked"))
    all_evidence = []
    for r in module_results.values():
        all_evidence.extend(r.get("evidence", []))

    report = {
        "tier":             tier,
        "subject":          subject,
        "county":           county,
        "state":            state,
        "domain":           domain,
        "started_at":       started_at,
        "completed_at":     datetime.now(timezone.utc).isoformat(),
        "modules_run":      modules,
        "modules_found":    found_count,
        "modules_errored":  error_count,
        "total_evidence":   len(all_evidence),
        "evidence_summary": all_evidence[:20],
        "module_results":   module_results,
    }

    log.info(
        f"[{tier}] Complete — {found_count}/{len(modules)} modules found data, "
        f"{len(all_evidence)} evidence items"
    )
    return report


# ─────────────────────────────────────────────────────────────────────────────
# CLI ENTRYPOINT
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="tw_engine",
        description="TraceWorks Free OSINT Investigation Engine — tier-based public records research",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tw_engine.py --tier T1 --subject "Jane Doe" --state TX
  python tw_engine.py --tier T2 --subject "Smith Holdings LLC" --county harris --state TX
  python tw_engine.py --tier T3 --subject "Robert Johnson" --county travis --state TX
  python tw_engine.py --tier T4 --subject "123 Main St" --county harris --domain "smithco.com"
  python tw_engine.py --tier T2 --subject "Acme Corp" --output report.json
        """,
    )
    parser.add_argument("--tier",    required=True,  choices=["T1", "T2", "T3", "T4"], help="Investigation tier (T1=Locate, T2=Ownership, T3=Probate, T4=Comprehensive)")
    parser.add_argument("--subject", required=True,  help="Subject: person name, company name, or property address")
    parser.add_argument("--county",  default=None,   help="Texas county name (e.g., harris, travis, bexar)")
    parser.add_argument("--state",   default="TX",   help="US state abbreviation (default: TX)")
    parser.add_argument("--domain",  default=None,   help="Domain name to investigate (e.g., smithco.com)")
    parser.add_argument("--output",  default=None,   help="Output file path for JSON report (default: stdout)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    report = run_tier(
        tier=args.tier,
        subject=args.subject,
        county=args.county,
        state=args.state,
        domain=args.domain,
    )

    output_json = json.dumps(report, indent=2, default=str)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(output_json)
        log.info(f"Report written to: {args.output}")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
