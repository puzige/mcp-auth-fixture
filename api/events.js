import { handleEvents } from '../lib/fixture.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }
  return handleEvents(req, res)
}
