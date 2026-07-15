import { handleMcp } from '../lib/fixture.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }
  return handleMcp(req, res)
}
