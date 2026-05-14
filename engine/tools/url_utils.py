"""Shared URL validation utilities to prevent SSRF attacks."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


def validate_url(url: str) -> None:
    """Validate URL to prevent SSRF attacks.

    Rejects non-HTTP schemes and private/internal IP addresses.
    Raises ValueError if the URL is unsafe.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Blocked: scheme '{parsed.scheme}' is not allowed")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Blocked: URL has no hostname")

    try:
        resolved = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Blocked: cannot resolve hostname '{hostname}'") from exc

    for family, _type, _proto, _canonname, sockaddr in resolved:
        addr = ipaddress.ip_address(sockaddr[0])
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            raise ValueError(f"Blocked: hostname '{hostname}' resolves to private/reserved IP {addr}")


def validate_github_url(url: str) -> None:
    """Validate that a URL is a safe GitHub repository URL.

    Only allows https://github.com/ URLs with no protocol exploits.
    Raises ValueError if the URL is unsafe.
    """
    if not url.startswith("https://github.com/"):
        raise ValueError("Blocked: only https://github.com/ URLs are allowed for plugin installation")

    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Blocked: only HTTPS scheme is allowed")

    if parsed.hostname != "github.com":
        raise ValueError("Blocked: only github.com host is allowed")

    if ".." in parsed.path or "//" in parsed.path:
        raise ValueError("Blocked: URL contains suspicious path segments")
