# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in MIX, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email your findings to the maintainer via [GitHub Security Advisories](https://github.com/baishen666-pj/MIX/security/advisories/new).
3. Include:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

## Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix and disclosure | Depends on severity |

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x | Yes |
| < 0.1.0 | No |

## Security Features

MIX includes the following security measures:

- **API key authentication** with per-key rate limiting
- **Sandboxed tool execution** (Docker isolation, subprocess restrictions)
- **SSRF protection** on outbound requests
- **Input validation** via Zod (gateway) and Pydantic (engine)
- **Docker non-root** execution for all services
- **Secret management** via environment variables (no hardcoded credentials)
