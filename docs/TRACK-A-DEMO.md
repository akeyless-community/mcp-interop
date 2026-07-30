# Track A demo runbook - OAuth / OPRM (MCP Server)

Use this after the interop server is running and a complementary MCP Client partner is ready.

## Goal

Have a partner MCP Client check **OAuth Protected Resource Metadata (OPRM)** for Akeyless as MCP Server.

## Preconditions

- [ ] `openid-mcp-server-interop` built and reachable over HTTPS (or HTTP for lab)
- [ ] `INTEROP_AUTHORIZATION_SERVERS` points at the partner-usable AS issuer
- [ ] Token validation configured (`INTEROP_JWKS_URI` preferred)
- [ ] Partner MCP Client supports OPRM discovery + Bearer tokens
- [ ] Both sides agree on resource URL and required scope (default `mcp:tools`)

## Script (15-30 min)

| Step | Actor | Action | Expected |
|---|---|---|---|
| 1 | Partner | Call MCP endpoint with no Authorization header | `401` |
| 2 | Partner | Read `WWW-Authenticate` | Contains `resource_metadata` and ideally `scope` |
| 3 | Partner | GET the `resource_metadata` URL | JSON OPRM with `resource`, `authorization_servers`, `scopes_supported` |
| 4 | Partner | Obtain access token from an AS listed in OPRM | Token with required audience + scope |
| 5 | Partner | Call MCP again with `Authorization: Bearer <token>` | MCP session works; `ping` succeeds |
| 6 | Both | Fill OAuth matrix sheets (each fills the other role column) | No contradictions |
| 7 | Both | Submit agreed matrices to AIIM CG | Accepted |

## Negative checks (recommended)

| Check | Expected |
|---|---|
| Token with wrong audience | `401` |
| Token missing required scope | `401` |
| Expired token | `401` |

## Matrix cells to mark

On **OAuth - partner tests us**:

- OPRM -> PASS (required)
- scope in WWW-Authenticate -> PASS if verified

## After success

Update the top-level target: **OAuth token based access x MCP Server = PASS**.

We will demonstrate ARA on the booth.
