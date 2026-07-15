# MCP Auth Fixture

Minimal mock MCP server for testing auth (dynamic API key + username/password). Deployable on Vercel.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness + current mode |
| `GET` | `/events` | Recent request audit trail |
| `GET`/`POST` | `/mode` | Read / set failure mode |
| `POST` | `/reset` | Clear events |
| `POST` | `/mcp` | MCP JSON-RPC |

### Modes

- `success` — auth ok, tool returns payload
- `business_403` — ordinary business 403
- `structured_invalid_403` — structured invalid credential 403

### Expected credentials (defaults)

- Dynamic header: `X-E2E-Key: local-e2e-secret`
- Username / password: `local-user` / `local-password`

Override via env: `EXPECTED_DYNAMIC_KEY`, `EXPECTED_USERNAME`, `EXPECTED_PASSWORD`.

## Deploy to Vercel

1. Import this repo in [Vercel](https://vercel.com/new).
2. Framework: Other / no build command.
3. Optional: set the three env vars above.
4. MCP URL after deploy:

```text
https://<your-deployment>.vercel.app/mcp
```

## Local

```bash
node server.mjs
# -> http://127.0.0.1:8788/mcp

# Or
npx vercel dev
```

## Smoke

```bash
curl -s "$BASE/health"
curl -s -X POST "$BASE/mcp" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26"}}'
curl -s -X POST "$BASE/mcp" -H 'content-type: application/json' -H 'X-E2E-Key: local-e2e-secret' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_dynamic_auth","arguments":{"message":"hi"}}}'
```

## Notes

- `mode` / `events` live in process memory and reset on cold start. Fine for fixtures; not durable multi-instance audit.
