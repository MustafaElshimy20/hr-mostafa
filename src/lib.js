// Pure helpers used by the public site (kept separate so they are easy to test / edit)
export const LANGS = ['English', 'French', 'German', 'Dutch', 'Portuguese', 'Italian', 'Spanish', 'Hindi', 'Polish']
export const LEVELS = [['A2', 'A2 – Elementary'], ['B1', 'B1 – Intermediate'], ['B2', 'B2 – Upper-intermediate'], ['C1', 'C1 – Advanced'], ['C2', 'C2 – Proficient']]
export const GOVS = ['Cairo', 'Giza', 'Alexandria', 'Red Sea']
// [governorate, area, keywords found in the offer's Location text]
export const PLACES = [
  ['Cairo', 'Nasr City', ['nasr city']], ['Cairo', 'Maadi', ['maadi', 'zahraa']], ['Cairo', 'Heliopolis', ['heliopolis', 'masr el gedida']],
  ['Cairo', 'New Cairo', ['new cairo', 'kattameya', 'settlement']], ['Cairo', 'El Nozha', ['nozha']], ['Cairo', 'Downtown / Abbasiya', ['downtown', 'abbasiya']],
  ['Giza', 'Sheikh Zayed', ['zayed']], ['Giza', '6th of October', ['oct', 'motamyz']], ['Giza', 'Smart Village', ['smart village']],
  ['Alexandria', 'Smouha', ['smouha', 'alex']], ['Red Sea', 'Hurghada', ['hurghada']],
]
export const low = (s) => (s || '').toLowerCase()
export const placesOf = (o) => PLACES.filter((p) => p[2].some((k) => low(o.location).includes(k)))
export function govsOf(o) {
  const l = low(o.location), s = new Set(placesOf(o).map((p) => p[0]))
  if (l.includes('cairo')) s.add('Cairo'); if (l.includes('giza')) s.add('Giza'); return s
}
const cap = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase()
export function langLevels(o) {
  const out = {}, re = /(English|French|German|Dutch|Portuguese|Italian|Spanish|Hindi|Polish)\s*(A1|A2|B1|B2|C1|C2)/gi
  let m; while ((m = re.exec(o.language || ''))) { const k = cap(m[1]); if (!out[k]) out[k] = m[2].toUpperCase() }
  return out
}
const rank = (l) => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(l)
// true if the candidate (at `level`) meets the offer's requirement for `lang` (or for its hardest language when no lang chosen). Unknown requirement = shown.
export function levelOk(o, lang, level) {
  if (!level) return true
  const lv = langLevels(o), need = lang ? lv[lang] : Object.values(lv).sort((a, b) => rank(b) - rank(a))[0]
  return !need || rank(need) <= rank(level)
}
export const category = (o) => { const t = low(o.position + ' ' + o.company)
  if (/\bhr\b|recruit|payroll/.test(t)) return 'HR'
  if (/sales|appointment|lead|telemarket|solar|roofing/.test(t)) return 'Sales & Telesales'
  if (/customer|support|advisor|survey|account/.test(t)) return 'Customer Service'
  return 'Other' }
export const maxSalary = (o) => Math.max(0, ...((o.salary || '').match(/\d[\d,]*/g) || []).map((x) => +x.replace(/,/g, '')).filter((n) => n >= 5000 && n <= 100000))
export const rotational = (o) => low(o.shifts).startsWith('rotational')
export const gradsOnly = (o) => /graduate/i.test(o.education) && !/undergrad|dropout|gap|student/i.test(o.education)

// Keeps offers of the same company together. Companies stay in the order they were first added
// (ties -> A-Z); inside a company, offers keep the order they were added (ties -> A-Z by position).
// items: [{ o: offer, t: number (creation time or index) }]
export const companyKey = (c) => (c || '').replace(/\(.*?\)/g, '').trim().toLowerCase()
export function groupByCompany(items) {
  const first = {}
  items.forEach(({ o, t }) => { const k = companyKey(o.company); if (!(k in first) || t < first[k]) first[k] = t })
  return [...items].sort((a, b) => {
    const ka = companyKey(a.o.company), kb = companyKey(b.o.company)
    if (ka !== kb) return first[ka] - first[kb] || ka.localeCompare(kb)
    return a.t - b.t || (a.o.position || '').localeCompare(b.o.position || '')
  }).map((x) => x.o)
}
