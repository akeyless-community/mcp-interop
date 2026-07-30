# Akeyless MCP Interop (OpenID AIIM)

HTTP **MCP Server** for the [OpenID Foundation AIIM MCP Security Interoperability](https://openid.net/call-for-participation-demonstrate-mcp-based-ai-agent-security-with-open-identity-standards-2/) event (Gartner IAM Summit 2026).

| Item | Value |
|---|---|
| **Formal role** | MCP Server only |
| **Target matrix cell** | OAuth 2.1 — **OPRM** (OAuth Protected Resource Metadata) |
| **Out of initial scope** | CIMD, EMA/ID-JAG, MCP Gateway |
| **Booth** | ARA is demonstrated on the booth (separate from this repo) |

Partners verify that this server advertises OPRM and accepts Bearer access tokens. That qualifies the **OAuth token-based access × MCP Server** cell.

---

## Who continues from here

If you are picking this up:

1. Read this README.
2. Run **Local quick start** below and confirm tests pass.
3. Follow [docs/DEPLOY-AWS.md](docs/DEPLOY-AWS.md) to put a public HTTPS endpoint online.
4. Follow [docs/TRACK-A-DEMO.md](docs/TRACK-A-DEMO.md) with a partner MCP Client.
5. Fill the OAuth matrix (each side fills the **other** role column) and submit to AIIM CG — first success due **16 Oct 2026**.
6. Commit email to OpenID (if not already sent) is due **10 Aug 2026 PT** — see [docs/HANDOFF.md](docs/HANDOFF.md).

---

## What this server does

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /.well-known/oauth-protected-resource` | none | RFC 9728 OPRM document |
| `GET /health` | none | Liveness |
| `POST /mcp` | Bearer JWT | Streamable HTTP MCP (`ping` tool) |

Unauthenticated `/mcp` calls return **401** with:

```http
WWW-Authenticate: Bearer realm="akeyless-openid-mcp", resource_metadata="<oprm-url>", scope="mcp:tools"
```

Token validation uses either:
- `INTEROP_JWKS_URI` (preferred for partner tests), or
- `INTEROP_JWT_SECRET` (HS256 local/demo only — do not use for official partner AS tests)

---

## Local quick start

Requires Node.js 18+.

```bash
git clone https://github.com/akeyless-community/mcp-interop.git
cd mcp-interop
npm install
npm test
npm run build

cp .env.example .env
# edit .env if needed, then:
set -a && source .env && set +a
npm start
```

Smoke checks (another terminal):

```bash
curl -sS http://127.0.0.1:8790/health
curl -sS http://127.0.0.1:8790/.well-known/oauth-protected-resource
curl -sS -D - -o /dev/null -X POST http://127.0.0.1:8790/mcp \
  -H 'Content-Type: application/json' -d '{}'
```

Expect OPRM JSON and a **401** with `resource_metadata` + `scope` on the POST.

---

## Partner / production config

Set public HTTPS URLs (example hostname):

```bash
export INTEROP_HTTP_HOST=127.0.0.1
export INTEROP_HTTP_PORT=8790
export INTEROP_HTTP_PATH=/mcp
export INTEROP_RESOURCE=https://mcp-interop.example.com/mcp
export INTEROP_PUBLIC_BASE_URL=https://mcp-interop.example.com
export INTEROP_RESOURCE_METADATA_URL=https://mcp-interop.example.com/.well-known/oauth-protected-resource
export INTEROP_SCOPES=mcp:tools
export INTEROP_AUTHORIZATION_SERVERS=https://partner-as.example.com
export INTEROP_JWT_ISSUER=https://partner-as.example.com
export INTEROP_JWT_AUDIENCE=https://mcp-interop.example.com/mcp
export INTEROP_JWKS_URI=https://partner-as.example.com/.well-known/jwks.json
# do not set INTEROP_JWT_SECRET for partner tests
```

Full AWS / nginx / systemd steps: [docs/DEPLOY-AWS.md](docs/DEPLOY-AWS.md).

---

## Give partners

| Item | Value |
|---|---|
| MCP Server URL | `https://<your-dns>/mcp` |
| OPRM URL | `https://<your-dns>/.well-known/oauth-protected-resource` |
| Required scope | `mcp:tools` |
| Resource / audience | `https://<your-dns>/mcp` |

Partner flow: call without token → read `resource_metadata` → get token from AS listed in OPRM → call `/mcp` with `Authorization: Bearer <token>` → `ping`.

---

## Repo layout

```
src/
  index.ts      # process entry
  http.ts       # Express + Streamable HTTP + OPRM routes + auth gate
  oprm.ts       # RFC 9728 document + WWW-Authenticate builder
  auth.ts       # Bearer JWT verification (JWKS or HS256)
  config.ts     # INTEROP_* env loading
  server.ts     # MCP Server + ping tool
  oprm.test.ts  # unit tests
docs/
  HANDOFF.md      # status, deadlines, next owner checklist
  DEPLOY-AWS.md   # public HTTPS hosting
  TRACK-A-DEMO.md # partner OAuth matrix test script
```

---

## Scripts

| Command | Purpose |
|---|---|
| `npm test` | Unit tests |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run `dist/index.js` |

---

## References

- [Call for participation](https://openid.net/call-for-participation-demonstrate-mcp-based-ai-agent-security-with-open-identity-standards-2/)
- [Interop test plan (PDF)](https://openid.net/wp-content/uploads/2026/07/Gartner-IAM-Summit-MCP-Security-Interop-1.pdf)
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
