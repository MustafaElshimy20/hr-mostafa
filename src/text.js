// Display-only text helpers: they tidy how an offer's text is shown (capital first letter, spacing, bullet lists).
// They never change the stored text and never add words.
export const tidy = (s) => { const t = String(s ?? '').replace(/\s+/g, ' ').replace(/\s+([,;.!?])/g, '$1').replace(/([,;])(?=[A-Za-z])/g, '$1 ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : '' }

// split at ; | • new lines (and → for steps) but never inside ( ) so "(80% basic; 20% KPIs)" stays in one piece
function splitOutside(text, seps) {
  const out = []; let cur = '', depth = 0
  const s = String(text ?? '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++; else if (c === ')') depth = Math.max(0, depth - 1)
    const hit = depth === 0 && seps.find((p) => s.startsWith(p, i))
    if (hit) { out.push(cur); cur = ''; i += hit.length - 1 } else cur += c
  }
  out.push(cur); return out
}
export function toList(text, { arrows = false, sentences = false } = {}) {
  let parts = splitOutside(text, ['\n', ';', '•', ' | ', ...(arrows ? ['→', '->'] : [])]).map(tidy).filter(Boolean)
  if (sentences && parts.length === 1) { const p = parts[0].split(/(?<=[.!?])\s+(?=[A-Z])/).map(tidy).filter(Boolean); if (p.length > 1) parts = p }
  return parts
}
// "29,000 net fixed" says nothing more than the headline "29,000 EGP Net"; "Up to 18,000 (80% basic / 20% KPIs)" does.
export const plainSalary = (s) => /^[\d,.\sk\-–—]*\s*(egp)?\s*(net|gross)?\s*(fixed|basic|per month|monthly|\/\s*month)?\s*$/i.test(String(s || '').trim())
