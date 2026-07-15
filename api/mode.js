import { handleGetMode, handleSetMode } from '../lib/fixture.js'

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGetMode(req, res)
  if (req.method === 'POST') return handleSetMode(req, res)
  res.statusCode = 405
  res.end('Method Not Allowed')
}
