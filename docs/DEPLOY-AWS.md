> **Source repo:** https://github.com/akeyless-community/mcp-interop  
> Clone with `git clone https://github.com/akeyless-community/mcp-interop.git` then follow below.

# Deploy on AWS (public HTTPS for partners)

Assumes:
- Linux EC2 (Amazon Linux 2023 or Ubuntu)
- You own a DNS name (example: `mcp-interop.akeyless.io`)
- You have a TLS certificate for that name (ACM + ALB, or PEM files on the box)

Replace `mcp-interop.example.com` with your DNS name everywhere.

---

## Architecture (recommended)

```
Internet (443)
   -> nginx (TLS termination with your cert)
      -> 127.0.0.1:8790 (Node MCP interop app, HTTP only)
```

Do **not** expose Node directly on 8790 to the internet. Keep Security Group open only for **22** (your IP) and **443** (0.0.0.0/0 or partner ranges).

Alternative: put an **ALB + ACM cert** in front and keep nginx optional. Then ALB targets the instance on port 8790 (or 80 via nginx).

---

## 1. EC2 / network

1. Launch or reuse an EC2 instance (t3.small is enough).
2. Security Group inbound:
   - TCP **443** from partners / `0.0.0.0/0`
   - TCP **22** from your IP only
   - **No** public 8790
3. Attach an Elastic IP (optional but useful).
4. Create DNS **A** (or ALIAS) record: `mcp-interop.example.com` -> instance/ALB.

---

## 2. Install runtime packages

### Amazon Linux 2023

```bash
sudo dnf update -y
sudo dnf install -y nginx git
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v   # expect v20+
```

### Ubuntu 22.04/24.04

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

---

## 3. Deploy the app

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin mcpinterop || true
sudo mkdir -p /opt/akeyless-openid-mcp-interop
sudo chown -R "$USER":"$USER" /opt/akeyless-openid-mcp-interop

# Copy the repo folder onto the machine (scp/rsync/git), then:
cd /opt/akeyless-openid-mcp-interop
# if you copied only the package:
# cd /opt/akeyless-openid-mcp-interop   # contents of openid-mcp-server-interop/

npm ci
npm test
npm run build
```

If you sync from your laptop:

```bash
rsync -av --exclude node_modules --exclude dist \
  ./openid-mcp-server-interop/ \
  ec2-user@YOUR_HOST:/opt/akeyless-openid-mcp-interop/
```

---

## 4. Environment file (use your public HTTPS URLs)

```bash
sudo tee /etc/akeyless-openid-mcp-interop.env >/dev/null <<'EOF'
INTEROP_HTTP_HOST=127.0.0.1
INTEROP_HTTP_PORT=8790
INTEROP_HTTP_PATH=/mcp

# Public URLs partners will use (must be https + your DNS)
INTEROP_RESOURCE=https://mcp-interop.example.com/mcp
INTEROP_PUBLIC_BASE_URL=https://mcp-interop.example.com
INTEROP_RESOURCE_METADATA_URL=https://mcp-interop.example.com/.well-known/oauth-protected-resource

INTEROP_SCOPES=mcp:tools

# Fill these from the partner Authorization Server (required for real tests)
INTEROP_AUTHORIZATION_SERVERS=https://partner-as.example.com
INTEROP_JWT_ISSUER=https://partner-as.example.com
INTEROP_JWT_AUDIENCE=https://mcp-interop.example.com/mcp
INTEROP_JWKS_URI=https://partner-as.example.com/.well-known/jwks.json

# Leave JWT_SECRET unset for partner tests.
# INTEROP_JWT_SECRET=
EOF

sudo chmod 640 /etc/akeyless-openid-mcp-interop.env
sudo chown root:mcpinterop /etc/akeyless-openid-mcp-interop.env
```

Important:
- `INTEROP_RESOURCE`, `INTEROP_JWT_AUDIENCE`, and the public MCP URL must match.
- Until a partner AS is known, you can temporarily set `INTEROP_JWT_SECRET` for smoke tests only; remove it for official interop.

---

## 5. systemd service

```bash
sudo tee /etc/systemd/system/akeyless-openid-mcp-interop.service >/dev/null <<'EOF'
[Unit]
Description=Akeyless OpenID MCP Server Interop
After=network.target

[Service]
Type=simple
User=mcpinterop
Group=mcpinterop
WorkingDirectory=/opt/akeyless-openid-mcp-interop
EnvironmentFile=/etc/akeyless-openid-mcp-interop.env
ExecStart=/usr/bin/node /opt/akeyless-openid-mcp-interop/dist/index.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

sudo chown -R mcpinterop:mcpinterop /opt/akeyless-openid-mcp-interop
sudo systemctl daemon-reload
sudo systemctl enable --now akeyless-openid-mcp-interop
sudo systemctl status akeyless-openid-mcp-interop --no-pager
```

Local check (on the box):

```bash
curl -sS http://127.0.0.1:8790/health
curl -sS http://127.0.0.1:8790/.well-known/oauth-protected-resource
```

---

## 6. TLS with nginx (certificate files on the instance)

Place certs, for example:

- `/etc/ssl/certs/mcp-interop.example.com.crt` (full chain)
- `/etc/ssl/private/mcp-interop.example.com.key`

```bash
sudo tee /etc/nginx/conf.d/mcp-interop.conf >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name mcp-interop.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mcp-interop.example.com;

    ssl_certificate     /etc/ssl/certs/mcp-interop.example.com.crt;
    ssl_certificate_key /etc/ssl/private/mcp-interop.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location = /health {
        proxy_pass http://127.0.0.1:8790/health;
    }

    location = /.well-known/oauth-protected-resource {
        proxy_pass http://127.0.0.1:8790/.well-known/oauth-protected-resource;
    }

    location /mcp {
        proxy_pass http://127.0.0.1:8790/mcp;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Authorization $http_authorization;
        proxy_buffering off;
    }
}
EOF

sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

### If using ACM + ALB instead

1. Request/validate ACM cert for `mcp-interop.example.com`.
2. ALB HTTPS listener 443 with that cert.
3. Target group -> instance port **8790** (or 80 if nginx terminates nothing).
4. Still set all `INTEROP_*` URLs to `https://mcp-interop.example.com/...`.

---

## 7. Verify from your laptop

```bash
curl -sS https://mcp-interop.example.com/health
curl -sS https://mcp-interop.example.com/.well-known/oauth-protected-resource
curl -sS -D - -o /dev/null -X POST https://mcp-interop.example.com/mcp \
  -H 'Content-Type: application/json' -d '{}'
```

Expect:
- health -> `{"status":"ok",...}`
- OPRM JSON with `"resource":"https://mcp-interop.example.com/mcp"`
- POST /mcp without token -> **401** and header:

```http
WWW-Authenticate: Bearer realm="akeyless-openid-mcp", resource_metadata="https://mcp-interop.example.com/.well-known/oauth-protected-resource", scope="mcp:tools"
```

Confirm OPRM `authorization_servers` lists the AS you agreed with the partner.

---

## 8. Give partners

| Item | Value |
|---|---|
| MCP Server URL | `https://mcp-interop.example.com/mcp` |
| OPRM URL | `https://mcp-interop.example.com/.well-known/oauth-protected-resource` |
| Required scope | `mcp:tools` |
| Resource / audience | `https://mcp-interop.example.com/mcp` |
| Role | MCP Server (OAuth / OPRM) |

Partner flow: unauthenticated call -> read `resource_metadata` -> get token from AS in OPRM -> call `/mcp` with `Authorization: Bearer <token>` -> `ping`.

---

## 9. Ops cheat sheet

```bash
sudo systemctl status akeyless-openid-mcp-interop
sudo journalctl -u akeyless-openid-mcp-interop -f
sudo systemctl restart akeyless-openid-mcp-interop
sudo nginx -t && sudo systemctl reload nginx
```

After code updates:

```bash
cd /opt/akeyless-openid-mcp-interop
npm ci && npm test && npm run build
sudo systemctl restart akeyless-openid-mcp-interop
```

---

## Checklist before announcing to AIIM partners

- [ ] DNS resolves to your host/ALB
- [ ] HTTPS works with a valid public cert
- [ ] `/health` and OPRM are publicly reachable
- [ ] Unauthenticated `/mcp` returns 401 with `resource_metadata` + `scope`
- [ ] Env uses **https** public URLs (not localhost)
- [ ] `INTEROP_JWKS_URI` / issuer / audience match the partner AS
- [ ] Port 8790 is not open to the world
