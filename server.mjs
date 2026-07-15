import http from 'node:http'
import {
  handleEvents,
  handleGetMode,
  handleHealth,
  handleMcp,
  handleReset,
  handleSetMode,
} from './lib/fixture.js'

const port = Number(process.env.PORT || 8788)

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname

  if (req.method === 'GET' && path === '/health') return handleHealth(req, res)
  if (req.method === 'GET' && path === '/events') return handleEvents(req, res)
  if (req.method === 'GET' && path === '/mode') return handleGetMode(req, res)
  if (req.method === 'POST' && path === '/reset') return handleReset(req, res)
  if (req.method === 'POST' && path === '/mode') return handleSetMode(req, res)
  if (req.method === 'POST' && path === '/mcp') return handleMcp(req, res)

  res.statusCode = 404
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ error: 'not_found' }))
})

server.listen(port, '0.0.0.0', () => {
  console.log(`MCP auth fixture listening on ${port}`)
})
