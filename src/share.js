// The text that is sent when a visitor taps "Share on WhatsApp".
// Written by the admin (Site settings -> Share message, or one offer's own message). {placeholders} are filled in per offer.
import { salaryLabel } from './lib'
import { valuesOf, filterById } from './taxonomy'

export const SHARE_VARS = [['position', 'Job title'], ['company', 'Company'], ['salary', 'Salary'], ['location', 'Location'], ['area', 'Area'], ['language', 'Language'],
  ['shifts', 'Shift'], ['work', 'Work mode'], ['education', 'Education'], ['link', 'Offer link']]
export const DEFAULT_SHARE = '🔥 Job offer: {position} at {company}\n💰 {salary}\n📍 {area}\n\nDetails & how to apply:\n{link}'
export const SHARE_EMOJIS = ['🔥', '✨', '🚀', '💼', '💰', '📍', '🗣️', '🕐', '🏢', '🏠', '🎓', '✅', '👉', '📌', '⭐', '📢', '🆕', '💬', '📞', '🎯', '👩', '👨', '⏰', '🤝']

const first = (s) => String(s || '').split(/[;(\n]/)[0].trim()
export function shareValues(o, tax, link) {
  const sl = salaryLabel(o), f = (id) => { const x = filterById(tax, id); return x ? valuesOf(o, x, tax) : [] }
  const areas = f('area')
  return {
    position: o.position || '', company: o.company || '',
    salary: sl.text === 'Salary on request' ? '' : sl.text + (sl.type ? ' ' + sl.type.toLowerCase() : ''),
    location: first(o.location), area: areas.length ? areas.slice(0, 2).join(' / ') : first(o.location),
    language: o.language && o.language.length <= 60 ? o.language : '', shifts: first(o.shifts), work: f('work').join(' / '), education: first(o.education), link,
  }
}
// A line that uses a placeholder with nothing to show (e.g. "📍 {area}" on an offer without a place) is left out, so there are never blank lines like "💰 ".
function render(tpl, o, tax, link, autoLink) {
  const v = shareValues(o, tax, link)
  const out = tpl.replace(/\r/g, '').split('\n').filter((line) => { const ks = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k in v); return !ks.length || ks.every((k) => v[k]) })
    .map((line) => line.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m))).join('\n')
  return ((autoLink && !/\{link\}/.test(tpl)) ? out + '\n\n' + link : out).replace(/\n{3,}/g, '\n\n').trim()
}
export function shareMessage(o, tax, template, link) {
  return render((o.share_text || '').trim() || (template || '').trim() || DEFAULT_SHARE, o, tax, link, true)
}

// The text that is sent to you when a candidate taps "Apply via WhatsApp". Site-wide message (Site settings) or one offer's own (apply_text).
export const DEFAULT_APPLY = "Hello, I'd like to apply for: {position} at {company}\n📍 {area}"
export function applyMessage(o, tax, template, link) {
  const tpl = (o.apply_text || '').trim() || (template || '').trim()
  if (!tpl) { // the original wording, kept exactly
    const loc = o.location ? ' (' + o.location.split(/[;(]/)[0].trim() + ')' : ''
    return `Hello, I'd like to apply for: ${o.position} at ${o.company}${loc}`
  }
  return render(tpl, o, tax, link, false)
}
