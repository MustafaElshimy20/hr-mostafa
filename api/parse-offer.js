// Optional AI helper for "Smart fill" (Vercel serverless function).
// Turns a pasted job post into the offer fields. Works only if GEMINI_API_KEY is set in Vercel;
// otherwise the site silently uses its built-in offline parser. The key never reaches the browser.
const FIELDS = ['company', 'position', 'location', 'nationality', 'salary', 'salary_type', 'shifts', 'work_mode', 'age', 'education', 'experience', 'military', 'transport', 'language', 'benefits', 'steps', 'interview_type', 'interview_time', 'link', 'notes', 'internal']

const PROMPT = `You extract a job offer from a recruiter's pasted post (English, Egyptian Arabic or mixed) into JSON for a job-offers website.
Rules:
- Write every value in short, clear, professional ENGLISH (translate Arabic). Keep names, numbers, links and times exactly as written.
- NEVER invent anything. If a detail is not in the text, return an empty string for it.
- salary: the pay as written (e.g. "15,000 net + commission"). salary_type: "Net", "Gross" or "Not specified".
- work_mode: "On-site", "Work from home" or "Hybrid" (empty if unknown).
- language: e.g. "French C1 + English B2". education: e.g. "Graduates, undergrads". age: e.g. "20-30" or "Max 35".
- interview_type: e.g. "Online interview", "Site interview". interview_time: days and hours of the interview.
- steps: the application steps joined with " -> ". benefits: one benefit per line.
- location: area / city only (e.g. "Nasr City, Cairo").
- internal: anything useful that fits no other field (contacts, remarks to the recruiter). notes: only text meant for candidates.
Return ONLY the JSON object.`

const send = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
const body = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 40000) req.destroy() }); req.on('end', () => { try { ok(JSON.parse(d || '{}')) } catch { ok({}) } }); req.on('error', () => ok({})) })

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  const key = process.env.GEMINI_API_KEY
  if (!key) return send(res, 501, { error: 'AI is not configured' })

  // only the signed-in admin may use it (otherwise strangers could burn the free quota)
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
  if (url && anon) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return send(res, 401, { error: 'Sign in first' })
    const u = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token } }).catch(() => null)
    if (!u || !u.ok) return send(res, 401, { error: 'Sign in first' })
  }

  const { text } = await body(req)
  if (typeof text !== 'string' || text.trim().length < 10) return send(res, 400, { error: 'Text is too short' })
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
  const schema = { type: 'OBJECT', properties: Object.fromEntries(FIELDS.map((f) => [f, { type: 'STRING' }])) }
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT + '\n\nPOST:\n' + text.slice(0, 8000) }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema } }),
    })
    if (!r.ok) return send(res, 502, { error: 'AI request failed (' + r.status + ')' })
    const j = await r.json(), raw = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text
    const out = JSON.parse(raw || '{}'), clean = {}
    FIELDS.forEach((f) => { if (typeof out[f] === 'string' && out[f].trim()) clean[f] = out[f].trim().slice(0, 1500) })
    return send(res, 200, clean)
  } catch { return send(res, 502, { error: 'AI request failed' }) }
}
