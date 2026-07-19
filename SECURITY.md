# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability, leaked credential, or privacy problem. Use the repository's private security advisory form:

https://github.com/gordonbmoges-spec/timeless-minds-handwriting/security/advisories/new

Include the affected route or file, reproduction steps, impact, and any suggested mitigation. Do not include real API keys, handwriting samples, or other personal data.

## Secret handling

- Real credentials belong in an untracked `.env` file or the hosting provider's encrypted environment settings.
- `.env.example` contains names and placeholders only.
- Browser-provided API keys are kept only in page memory, sent to the same-origin backend over HTTPS, and cleared on refresh or close.
- The server does not intentionally log API keys, request bodies, handwriting images, or model responses.
- Run `npm run security:secrets -- --history` before publishing changes.

If a real key is ever committed, revoke it first. Removing it from the latest commit is not sufficient because git history and forks may retain it.

## Deployment boundary

The included server is suitable for local demos and controlled deployments. A public deployment that uses an operator-owned server API key must add authentication, provider-side spending limits, request rate limiting, monitoring, and an abuse-response process. Without those controls, keep the site in demo or user-supplied-key mode.

The project validates outbound API URLs as HTTPS and rejects common loopback and private-network hostnames. Operators remain responsible for provider allowlists, DNS controls, and infrastructure-level egress policy.

Custom books accept only a generated `custom-*` ID and bounded plain-text identity fields. The backend labels those fields and long-term memory as untrusted context; neither is allowed to replace the server's response, safety, privacy, or output-format rules.
