// Categories + filters engine. Everything the public site filters by comes from the "taxonomy" saved in the admin
// (Admin -> Categories / Filters), so nothing here is tied to specific filters. The built-in filters below are only the starting set.
//
// A filter = { id, label, visible, builtin, kind: 'options' | 'level', field, pick: 'all' | 'first', fallback, unrestricted, dependsOn, detector, options: [...] }
// An option = { v: 'Cairo', kw: ['cairo'], parent?: 'Cairo', k?: 'online', min?, max?, label? }
//
// An offer gets its values for a filter in ONE of two ways:
//   1. explicitly, from the admin ->  offer.tags[filterId] = ['Cairo', 'Giza']   (the admin's choice always wins)
//   2. automatically, by reading the offer's own text (filter.field) for the option keywords (whole words only).
import { salaryFigure } from './lib'

export const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const optLabel = (x) => x.label || x.v
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const RE = new Map()
// keyword -> regex. Whole words only ("oct" does not match "doctor"). A trailing * means "starts with" (grad* = graduate, grads, graduation).
// Spaces and hyphens are interchangeable ("on-site" = "on site").
const kwBody = (k) => esc(k.endsWith('*') ? k.slice(0, -1).trim() : k).replace(/[\s-]+/g, '[\\s-]+')
export function kwRegex(kw) {
  const k = norm(kw).trim(); if (!k) return null
  if (RE.has(k)) return RE.get(k)
  const re = new RegExp('(?:^|[^a-z0-9])' + kwBody(k) + (k.endsWith('*') ? '' : '(?![a-z0-9])'))
  RE.set(k, re); return re
}
export const kwsOf = (x) => [...new Set([x.v, ...(x.kw || [])].map((k) => String(k).trim()).filter(Boolean))]

export const LV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const op = (v, kw = [], x = {}) => ({ v, kw, ...x })
export const defaultTax = () => ({
  categories: ['Customer Service', 'Sales & Telesales', 'HR', 'Technical Support', 'Data Entry', 'Graphic Designer', 'Other'],
  filters: [
    { id: 'gov', label: 'Governorate', visible: true, builtin: true, kind: 'options', field: 'location', pick: 'all', options: [
      op('Cairo', ['cairo']), op('Giza', ['giza']), op('Alexandria', ['alexandria', 'alex']), op('Red Sea', ['red sea', 'hurghada'])] },
    { id: 'area', label: 'Area', visible: true, builtin: true, kind: 'options', field: 'location', pick: 'all', dependsOn: 'gov', options: [
      op('Nasr City', ['nasr city'], { parent: 'Cairo' }), op('Maadi', ['maadi', 'zahraa'], { parent: 'Cairo' }), op('Heliopolis', ['heliopolis', 'masr el gedida'], { parent: 'Cairo' }),
      op('New Cairo', ['new cairo', 'kattameya', 'settlement'], { parent: 'Cairo' }), op('El Nozha', ['nozha'], { parent: 'Cairo' }), op('Downtown / Abbasiya', ['downtown', 'abbasiya'], { parent: 'Cairo' }),
      op('Sheikh Zayed', ['zayed'], { parent: 'Giza' }), op('6th of October', ['6th of october', '6th october', '6 october', 'october', 'oct', 'motamyz'], { parent: 'Giza' }), op('Smart Village', ['smart village'], { parent: 'Giza' }),
      op('Smouha', ['smouha', 'alex', 'alexandria'], { parent: 'Alexandria' }), op('Hurghada', ['hurghada'], { parent: 'Red Sea' })] },
    { id: 'lang', label: 'Language', visible: true, builtin: true, kind: 'options', field: 'language', pick: 'all',
      options: ['English', 'French', 'German', 'Dutch', 'Portuguese', 'Italian', 'Spanish', 'Hindi', 'Polish'].map((v) => op(v)) },
    { id: 'level', label: 'My language level', visible: true, builtin: true, kind: 'level', langFilter: 'lang',
      options: [['A2', 'A2 – Elementary'], ['B1', 'B1 – Intermediate'], ['B2', 'B2 – Upper-intermediate'], ['C1', 'C1 – Advanced'], ['C2', 'C2 – Proficient']].map(([v, label]) => ({ v, label })) },
    { id: 'edu', label: 'Education status', visible: true, builtin: true, kind: 'options', field: 'education', pick: 'all', unrestricted: true, options: [
      op('Graduate', ['grad*']), op('Undergraduate / student', ['undergrad*', 'student*']), op('Gap year', ['gap']), op('Dropout', ['dropout*', 'dropped'])] },
    { id: 'shift', label: 'Shift type', visible: true, builtin: true, kind: 'options', field: 'shifts', pick: 'first', fallback: 'Fixed shift', options: [
      op('Fixed shift', ['fixed']), op('Rotational', ['rotat*'])] },
    { id: 'work', label: 'Work mode', visible: true, builtin: true, kind: 'options', field: 'work_mode', pick: 'first', fallback: 'On-site', options: [
      op('On-site', ['on-site', 'onsite', 'on site']), op('Work from home', ['work from home', 'wfh', 'remote']), op('Hybrid', ['hybrid'])] },
    { id: 'iv', label: 'Interview type', visible: true, builtin: true, kind: 'options', detector: 'interview', pick: 'all', options: [
      op('Online interview only', [], { k: 'online' }), op('On-site interview only', [], { k: 'site' }), op('Online, then on-site', [], { k: 'both' })] },
    { id: 'sal', label: 'Salary (EGP / month)', visible: false, builtin: true, kind: 'options', field: 'salary', pick: 'all', options: [
      op('Under 10,000', [], { min: 0, max: 10000 }), op('10,000 – 15,000', [], { min: 10000, max: 15000 }), op('15,000 – 20,000', [], { min: 15000, max: 20000 }), op('20,000 and above', [], { min: 20000 })] },
  ],
})

// Turns whatever was stored (or nothing) into a complete, valid taxonomy. Built-in filters that are missing are added back.
export function normTax(raw) {
  const d = defaultTax()
  let t = raw; if (typeof t === 'string') { try { t = JSON.parse(t) } catch { t = null } }
  if (!t || typeof t !== 'object') return d
  const seen = new Set(), cats = []
  ;(Array.isArray(t.categories) ? t.categories : d.categories).forEach((c) => { c = String(c || '').trim(); if (c && !seen.has(norm(c))) { seen.add(norm(c)); cats.push(c) } })
  if (!seen.has('other')) cats.push('Other')
  const cleanOpts = (a) => { const s = new Set(); return (Array.isArray(a) ? a : []).filter((x) => x && String(x.v ?? '').trim() && !s.has(norm(x.v)) && s.add(norm(x.v))).map((x) => ({ ...x, v: String(x.v).trim(), kw: (x.kw || []).map(String).filter(Boolean) })) }
  const stored = Array.isArray(t.filters) ? t.filters : [], out = []
  stored.forEach((s) => { if (!s || !s.id) return; const base = d.filters.find((x) => x.id === s.id)
    if (base) out.push({ ...base, ...s, builtin: true, kind: base.kind, options: base.kind === 'level' ? base.options : cleanOpts(s.options) })
    else out.push({ field: '', pick: 'all', ...s, builtin: false, kind: 'options', options: cleanOpts(s.options) }) })
  d.filters.forEach((b) => { if (!out.some((x) => x.id === b.id)) out.push(b) })
  return { categories: cats, filters: out }
}

// ---------- values of an offer for one filter ----------
const MEMO = new WeakMap()
const memo = (o, tax, key, fn) => { let m = MEMO.get(o); if (!m || m.tax !== tax) { m = { tax, v: new Map() }; MEMO.set(o, m) }
  if (!m.v.has(key)) m.v.set(key, fn()); return m.v.get(key) }
const inOrder = (fl, set) => fl.options.map((x) => x.v).filter((v) => set.has(v))

function interviewKey(o) { const t = norm((o.interview_type || '') + ' ' + (o.steps || '')), on = /online/.test(t), site = /\bsite\b|on-?site/.test(t); return on && site ? 'both' : on ? 'online' : site ? 'site' : '' }

function own(o, fl) { // explicit tags, else read from the text. No parent propagation.
  const ex = o.tags && o.tags[fl.id]
  if (Array.isArray(ex)) return inOrder(fl, new Set(ex))
  const hit = new Set()
  if (fl.detector === 'interview') { const k = interviewKey(o); fl.options.forEach((x) => x.k && x.k === k && hit.add(x.v)) }
  else if (fl.field === 'salary') { const f = salaryFigure(o); if (f) fl.options.forEach((x) => { const lo = x.min ?? 0, hi = x.max ?? Infinity; if (f.max >= lo && f.min < hi) hit.add(x.v) }) }
  else if (fl.field && o[fl.field]) {
    const text = norm(o[fl.field]), found = []
    fl.options.forEach((x) => { let best = -1; kwsOf(x).forEach((k) => { const m = kwRegex(k) && kwRegex(k).exec(text); if (m && (best < 0 || m.index < best)) best = m.index }); if (best >= 0) found.push([best, x.v]) })
    if (fl.pick === 'first') found.sort((a, b) => a[0] - b[0]).splice(1)
    found.forEach(([, v]) => hit.add(v))
  }
  if (!hit.size && fl.fallback && fl.options.some((x) => x.v === fl.fallback)) hit.add(fl.fallback)
  return inOrder(fl, hit)
}
export function valuesOf(o, fl, tax) {
  return memo(o, tax, 'v:' + fl.id, () => {
    const vals = own(o, fl), ex = o.tags && o.tags[fl.id]
    if (Array.isArray(ex)) return vals
    const set = new Set(vals) // an offer found in an area is also in that area's governorate
    tax.filters.forEach((c) => { if (c.dependsOn === fl.id) own(o, c).forEach((v) => { const x = c.options.find((y) => y.v === v); if (x && x.parent) set.add(x.parent) }) })
    return inOrder(fl, set)
  })
}
export const filterById = (tax, id) => tax.filters.find((f) => f.id === id)

// ---------- language levels ("French C1 + English B2") ----------
export function levelNeeds(o, tax) {
  return memo(o, tax, 'needs', () => {
    const lf = tax.filters.find((f) => f.kind === 'level'), ex = lf && o.tags && o.tags[lf.id]
    if (Array.isArray(ex)) { const r = ex.map((v) => LV.indexOf(v)).filter((i) => i >= 0); return r.length ? { '*': LV[Math.max(...r)] } : {} }
    const langs = tax.filters.find((f) => f.id === (lf ? lf.langFilter : 'lang')), out = {}, text = norm(o.language || '')
    if (!langs) return out
    const L = '(a1|a2|b1|b2|c1|c2)(?![a-z0-9])', B = '(?:^|[^a-z0-9])'
    const names = langs.options.map((x) => [x.v, kwsOf(x).map((k) => norm(k).trim()).filter(Boolean).map(kwBody)])
    names.forEach(([v, bodies]) => bodies.forEach((b) => { if (out[v]) return // "French C1", "English (B2)", "German: C1"
      const m = new RegExp(B + b + '(?![a-z0-9])(?:\\s*[:(\\-–]\\s*|\\s+)(?:level\\s*)?' + L).exec(text); if (m) out[v] = m[1].toUpperCase() }))
    names.forEach(([v, bodies]) => bodies.forEach((b) => { if (out[v]) return // "B2 English" (single space only, so "C1 + English" is not misread)
      const m = new RegExp(B + L.replace('(?![a-z0-9])', '') + '\\+?\\s(?:level\\s)?' + b + '(?![a-z0-9])').exec(text); if (m) out[v] = m[1].toUpperCase() }))
    return out
  })
}
export function levelRank(o, tax, lang) { // -1 = no level stated
  const n = levelNeeds(o, tax), v = lang ? [n[lang] || n['*']] : Object.values(n)
  return Math.max(-1, ...v.filter(Boolean).map((x) => LV.indexOf(x)))
}
// does a candidate at `level` meet the offer's requirement? (offers that state no level are included)
export const levelOk = (o, tax, lang, level) => { if (!level) return true; const r = levelRank(o, tax, lang); return r < 0 || r <= LV.indexOf(level) }

// ---------- categories ----------
const RULES = [ // used only when an offer has no category chosen in the admin; matched on the job title
  ['HR', /\bhr\b|recruit|payroll|talent acqui/], ['Technical Support', /technical|tech support|help ?desk|\bit support/], ['Data Entry', /data entry/],
  ['Graphic Designer', /graphic|designer/], ['Sales & Telesales', /sales|appointment|\blead\b|telemarket|solar|roofing|business development/],
  ['Customer Service', /customer|support|advisor|survey|call cent|receptionist/],
]
const canon = (tax, c) => tax.categories.find((x) => norm(x) === norm(c)) || String(c).trim()
export function detectCategory(o, tax) {
  const pos = norm(o.position), has = (n) => tax.categories.some((c) => norm(c) === norm(n))
  const own = tax.categories.find((c) => norm(c) !== 'other' && norm(c).length >= 4 && new RegExp('(?:^|[^a-z0-9])' + esc(norm(c)) + '(?![a-z0-9])').test(pos)) // a category named in the job title
  if (own) return own
  const r = RULES.find(([n, re]) => has(n) && re.test(pos)); return r ? canon(tax, r[0]) : canon(tax, 'Other')
}
// An offer can have several categories: o.categories = ['Sales & Telesales', 'Graphic Designer'] (older offers may have a single o.category text)
export const explicitCats = (o) => (Array.isArray(o.categories) ? o.categories : o.category ? [o.category] : []).map((c) => String(c).trim()).filter(Boolean)
export const categoriesOf = (o, tax) => memo(o, tax, 'cats', () => { const ex = explicitCats(o)
  if (!ex.length) return [detectCategory(o, tax)]
  const out = []; ex.forEach((c) => { const k = canon(tax, c); if (!out.includes(k)) out.push(k) }); return out })
export const isAutoCategory = (o) => !explicitCats(o).length
export const withCats = (o, cats) => { const n = { ...o, categories: [...new Set(cats)] }; delete n.category; return n }
export const allCategories = (offers, tax) => { const l = [...tax.categories]; offers.forEach((o) => categoriesOf(o, tax).forEach((c) => { if (!l.includes(c)) l.push(c) })); return l }

// ---------- search ----------
const SKIP = new Set(['id', 'internal', 'link', 'status', 'tags', 'salary_type', 'category', 'categories'])
const squash = (s) => norm(s).replace(/(\d),(?=\d)/g, '$1')
const blob = (o, tax) => memo(o, tax, 'blob', () => squash([...Object.entries(o).filter(([k]) => !SKIP.has(k)).map(([, v]) => v), ...categoriesOf(o, tax), ...tax.filters.flatMap((f) => valuesOf(o, f, tax))].join(' ')))
const tokens = (q) => squash(q).split(/[\s,;،]+/).filter(Boolean)

// ---------- matching ----------
export function filterOk(o, fl, v, sel, tax) {
  if (!v) return true
  if (fl.kind === 'level') return levelOk(o, tax, sel[fl.langFilter], v)
  const vals = valuesOf(o, fl, tax)
  return vals.length ? vals.includes(v) : !!fl.unrestricted
}
// f = { q, cat, sel: { filterId: value }, saved }, ctx = { saved: [ids] }
export function matches(o, f, tax, ctx) {
  if (f.saved && !(ctx.saved || []).includes(o.id)) return false
  if (f.cat && !categoriesOf(o, tax).includes(f.cat)) return false
  for (const fl of tax.filters) if (!filterOk(o, fl, f.sel[fl.id], f.sel, tax)) return false
  if (f.q) { const b = blob(o, tax); if (!tokens(f.q).every((t) => b.includes(t))) return false }
  return true
}
// exact numbers for every chip / option: "how many results if I picked this one (keeping my other choices)?"
export function facetCounts(offers, f, tax, ctx) {
  const cat = {}, opt = {}
  const noCat = offers.filter((o) => matches(o, { ...f, cat: '' }, tax, ctx))
  noCat.forEach((o) => categoriesOf(o, tax).forEach((c) => { cat[c] = (cat[c] || 0) + 1 }))
  tax.filters.forEach((fl) => {
    const base = offers.filter((o) => matches(o, { ...f, sel: { ...f.sel, [fl.id]: '' } }, tax, ctx)), m = {}
    fl.options.forEach((x) => { const sel = { ...f.sel, [fl.id]: x.v }; m[x.v] = base.filter((o) => filterOk(o, fl, x.v, sel, tax)).length })
    opt[fl.id] = m
  })
  return { all: noCat.length, cat, opt }
}

// ---------- small helpers for the admin ----------
export const withTags = (o, id, vals) => ({ ...o, tags: { ...(o.tags || {}), [id]: vals } })
export function dropTags(o, id) { const t = { ...(o.tags || {}) }; delete t[id]; const n = { ...o, tags: t }; if (!Object.keys(t).length) delete n.tags; return n }
export const hasDetector = (fl) => !!(fl.field || fl.detector || fl.fallback)
