const expectedDynamicKey = process.env.EXPECTED_DYNAMIC_KEY || 'local-e2e-secret'
const expectedUsername = process.env.EXPECTED_USERNAME || 'local-user'
const expectedPassword = process.env.EXPECTED_PASSWORD || 'local-password'

/** Shared across warm serverless instances in the same isolate. Not durable across cold starts. */
const g = globalThis
if (!g.__mcpAuthFixture) {
  g.__mcpAuthFixture = {
    events: [],
    /** @type {'success' | 'business_403' | 'structured_invalid_403'} */
    mode: 'success',
  }
}

const state = g.__mcpAuthFixture

const tools = [
  {
    name: 'check_dynamic_auth',
    description: 'Returns whether the expected dynamic authentication header was injected.',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_username_password',
    description: 'Returns whether username and password were injected into tool arguments.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['message', 'username', 'password'],
      additionalProperties: false,
    },
  },
]

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function getHeader(req, name) {
  const headers = req.headers || {}
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return Array.isArray(v) ? v[0] : v
  }
  return undefined
}

function record(req, body) {
  const args = body?.params?.arguments
  const key = getHeader(req, 'x-e2e-key')
  state.events.push({
    at: new Date().toISOString(),
    method: body?.method ?? null,
    toolName: body?.params?.name ?? null,
    mode: state.mode,
    dynamicKeyPresent: key !== undefined,
    dynamicKeyValid: key === expectedDynamicKey,
    argumentKeys: args && typeof args === 'object' ? Object.keys(args).sort() : [],
    usernameValid: args?.username === expectedUsername,
    passwordValid: args?.password === expectedPassword,
  })
  if (state.events.length > 200) state.events.shift()
}

async function readJson(req) {
  if (req.body != null) {
    if (typeof req.body === 'string') {
      return req.body ? JSON.parse(req.body) : {}
    }
    return req.body
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

export async function handleHealth(_req, res) {
  sendJson(res, 200, { status: 'ok', mode: state.mode })
}

export async function handleEvents(_req, res) {
  sendJson(res, 200, { events: state.events, mode: state.mode })
}

export async function handleGetMode(_req, res) {
  sendJson(res, 200, { mode: state.mode })
}

export async function handleReset(_req, res) {
  state.events.length = 0
  sendJson(res, 200, { ok: true, mode: state.mode })
}

export async function handleSetMode(req, res) {
  let body
  try {
    body = await readJson(req)
  } catch {
    return sendJson(res, 400, { error: 'invalid_json' })
  }
  const next = body.mode
  if (!['success', 'business_403', 'structured_invalid_403'].includes(next)) {
    return sendJson(res, 400, {
      error: 'invalid_mode',
      allowed: ['success', 'business_403', 'structured_invalid_403'],
    })
  }
  state.mode = next
  sendJson(res, 200, { ok: true, mode: state.mode })
}

export async function handleMcp(req, res) {
  let body
  try {
    body = await readJson(req)
  } catch {
    return sendJson(res, 400, { error: 'invalid_json' })
  }
  record(req, body)

  if (body.method === 'notifications/initialized') {
    res.statusCode = 202
    return res.end()
  }
  if (body.method === 'initialize') {
    return sendJson(res, 200, rpcResult(body.id, {
      protocolVersion: body.params?.protocolVersion || '2025-03-26',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'mcp-auth-fixture', version: '1.0.0' },
    }))
  }
  if (body.method === 'tools/list') {
    return sendJson(res, 200, rpcResult(body.id, { tools }))
  }
  if (body.method === 'resources/list') {
    return sendJson(res, 200, rpcResult(body.id, { resources: [] }))
  }
  if (body.method === 'prompts/list') {
    return sendJson(res, 200, rpcResult(body.id, { prompts: [] }))
  }
  if (body.method === 'tools/call') {
    const key = getHeader(req, 'x-e2e-key')
    if (body.params?.name === 'check_dynamic_auth' && key !== expectedDynamicKey) {
      return sendJson(res, 401, { error: 'invalid_dynamic_key' })
    }
    const args = body.params?.arguments || {}
    if (
      body.params?.name === 'check_username_password' &&
      (args.username !== expectedUsername || args.password !== expectedPassword)
    ) {
      return sendJson(res, 401, { error: 'invalid_username_password' })
    }

    if (state.mode === 'business_403') {
      return sendJson(res, 403, {
        error: 'forbidden',
        message: 'business authorization denied for this resource',
        code: 'BUSINESS_FORBIDDEN',
      })
    }

    if (state.mode === 'structured_invalid_403') {
      return sendJson(res, 403, {
        error: 'invalid_api_key',
        code: 'invalid_api_key',
        message: 'API key is invalid',
      })
    }

    return sendJson(res, 200, rpcResult(body.id, {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ok: true,
          toolName: body.params?.name,
          dynamicKeyValid: key === expectedDynamicKey,
          usernameValid: args.username === expectedUsername,
          passwordValid: args.password === expectedPassword,
        }),
      }],
      isError: false,
    }))
  }

  return sendJson(res, 200, rpcResult(body.id, {}))
}

export { expectedDynamicKey, expectedUsername, expectedPassword, state }
