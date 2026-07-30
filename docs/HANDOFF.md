# Handoff — Akeyless OpenID MCP Server interop

Use this if you are continuing the OpenID AIIM participation work.

## Decision (locked)

| Choice | Value |
|---|---|
| Role | **MCP Server only** (not Gateway / OP / AS / Client) |
| First matrix target | **OAuth / OPRM** with a complementary MCP Client |
| Out of initial scope | CIMD, EMA/ID-JAG |
| Booth | ARA on booth only — not this repo’s job |

Participation = complementary-role tests + mutually agreed matrices. At least one success by **16 Oct 2026**. Commit by **10 Aug 2026 PT** to `atul.tulshibagwale@crowdstrike.com`.

## What is already done

- [x] HTTP Streamable MCP Server package in this repo
- [x] OPRM at `/.well-known/oauth-protected-resource`
- [x] `401` + `WWW-Authenticate` with `resource_metadata` and `scope`
- [x] Bearer JWT validation (JWKS or local HS256 secret)
- [x] `ping` tool for authenticated smoke test
- [x] Unit tests (`npm test`)
- [x] AWS deploy guide ([DEPLOY-AWS.md](DEPLOY-AWS.md))
- [x] Partner demo runbook ([TRACK-A-DEMO.md](TRACK-A-DEMO.md))

## What you still need to do

1. **Commit to OpenID** (if not sent) — draft below.
2. **Host publicly** — DNS + TLS + nginx/ALB per [DEPLOY-AWS.md](DEPLOY-AWS.md).
3. **Wire a real Authorization Server** — set `INTEROP_AUTHORIZATION_SERVERS`, `INTEROP_JWT_ISSUER`, `INTEROP_JWT_AUDIENCE`, `INTEROP_JWKS_URI`. Remove `INTEROP_JWT_SECRET`.
4. **Find a complementary MCP Client partner** on AIIM weekly calls.
5. **Run** [TRACK-A-DEMO.md](TRACK-A-DEMO.md); both sides fill OAuth matrix sheets with **no contradictions**.
6. **Submit** agreed matrices to AIIM CG before / by 16 Oct.

## Commit email draft

```text
To: atul.tulshibagwale@crowdstrike.com
Subject: Commitment - OpenID AIIM CG MCP Security Interop (Akeyless)

Hi Atul,

Akeyless commits to the OpenID AIIM CG MCP Security Interoperability Event.

Role: MCP Server

Initial standard / target: OAuth 2.1 token-based access to our MCP Server
(OAuth Protected Resource Metadata), tested with at least one complementary
MCP Client partner, with a first successful test targeted by 16 October 2026.

CIMD and EMA are out of our initial commitment scope.

Point of contact:
- Name:
- Email:
- Company: Akeyless

Thank you,
[Name]
```

## Env vars (quick reference)

| Variable | Required | Notes |
|---|---|---|
| `INTEROP_RESOURCE` | yes* | Public MCP resource URL (`https://.../mcp`) |
| `INTEROP_PUBLIC_BASE_URL` | recommended | Public origin for OPRM URL derivation |
| `INTEROP_RESOURCE_METADATA_URL` | optional | Override OPRM absolute URL |
| `INTEROP_AUTHORIZATION_SERVERS` | yes | Comma-separated AS issuer URLs in OPRM |
| `INTEROP_JWT_AUDIENCE` | yes* | Usually same as `INTEROP_RESOURCE` |
| `INTEROP_JWT_ISSUER` | recommended | Must match token `iss` |
| `INTEROP_SCOPES` | default `mcp:tools` | Advertised + required |
| `INTEROP_JWKS_URI` | partner mode | Preferred token verification |
| `INTEROP_JWT_SECRET` | local only | HS256 demo; unset for partner tests |
| `INTEROP_HTTP_HOST` | default `0.0.0.0` | Use `127.0.0.1` behind nginx |
| `INTEROP_HTTP_PORT` | default `8790` | |
| `INTEROP_HTTP_PATH` | default `/mcp` | |

\* Defaults to localhost URLs if unset — fine for lab, wrong for partners.

## Code map

| File | Responsibility |
|---|---|
| `src/http.ts` | HTTP server, OPRM route, auth gate, MCP transport |
| `src/oprm.ts` | OPRM JSON + `WWW-Authenticate` builder |
| `src/auth.ts` | JWT verify + scope check |
| `src/config.ts` | Env loading / validation |
| `src/server.ts` | MCP `ping` tool |
| `src/index.ts` | Entrypoint |

## Do not

- Commit `.env` (secrets)
- Claim CIMD/EMA without separate work and partner tests
- Expose Node port 8790 publicly — terminate TLS on nginx/ALB
- Mix booth ARA demo with OpenID matrix evidence

## Deadlines

| Date | Action |
|---|---|
| 10 Aug 2026 PT | Commit email |
| 16 Oct 2026 | ≥1 successful OPRM partner test |
| 7–9 Dec 2026 | Gartner IAM Summit / results |

## Contact / ownership

Fill in for your team:

- Engineering owner:
- AIIM weekly call attendee:
- Public hostname:
- Partner MCP Client (once known):
