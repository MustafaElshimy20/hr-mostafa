import { createClient } from '@supabase/supabase-js'
import seed from './offers.json'
import { groupByCompany } from './lib'
import { normTax } from './taxonomy'
const env = import.meta.env
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
export const sb = url && key ? createClient(url, key) : null
export const demo = !sb
export const DEFAULTS = { title: 'HR Mostafa', intro: 'Find the job offer that fits you. Search, filter, then apply on WhatsApp.', whatsapp: '201505885209', banner: '', footer: '', share_template: '' }
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const base = () => ls('hr_offers', seed.map((d, i) => ({ id: 's' + i, ...d })))
const put = (a) => localStorage.setItem('hr_offers', JSON.stringify(a))

export async function loadOffers() {
  if (demo) return groupByCompany(base().map((o, i) => ({ o, t: i })))
  const { data, error } = await sb.from('offers').select('id,data,created_at').order('created_at')
  if (error) throw error
  return groupByCompany(data.map((r) => ({ o: { id: r.id, ...r.data }, t: +new Date(r.created_at) })))
}
export async function saveOffer(o) {
  const { id, ...data } = o
  if (demo) { const a = base(); const i = a.findIndex((x) => x.id === id); i >= 0 ? (a[i] = { id, ...data }) : a.push({ id: 'n' + Date.now(), ...data }); return put(a) }
  const r = id ? await sb.from('offers').update({ data }).eq('id', id) : await sb.from('offers').insert({ data })
  if (r.error) throw r.error
}
export async function deleteOffer(id) {
  if (demo) return put(base().filter((x) => x.id !== id))
  const { error } = await sb.from('offers').delete().eq('id', id); if (error) throw error
}
export async function saveMany(items) {
  if (demo) { const m = new Map(items.map((x) => [x.id, x])); return put(base().map((x) => m.get(x.id) || x)) }
  await Promise.all(items.map(saveOffer))
}
export async function deleteMany(ids) {
  if (demo) return put(base().filter((x) => !ids.includes(x.id)))
  const { error } = await sb.from('offers').delete().in('id', ids); if (error) throw error
}
export async function importMany(list) {
  const rows = list.map(({ id, ...d }) => d), t0 = Date.now()
  if (demo) return put([...base(), ...rows.map((d, i) => ({ id: 'n' + (t0 + i), ...d }))])
  const { error } = await sb.from('offers').insert(rows.map((data, i) => ({ data, created_at: new Date(t0 + i).toISOString() }))); if (error) throw error
}
export async function importStarter() {
  const t0 = Date.now() // staggered timestamps keep the starter order
  const { error } = await sb.from('offers').insert(seed.map((data, i) => ({ data, created_at: new Date(t0 + i).toISOString() }))); if (error) throw error
}
export async function loadSettings() {
  if (demo) return { ...DEFAULTS, ...ls('hr_settings', {}) }
  const { data } = await sb.from('site_settings').select('key,value')
  return { ...DEFAULTS, ...Object.fromEntries((data || []).filter((r) => r.key !== 'taxonomy').map((r) => [r.key, r.value])) }
}
export async function saveSettings(s) {
  if (demo) return localStorage.setItem('hr_settings', JSON.stringify(s))
  const { error } = await sb.from('site_settings').upsert(Object.entries(s).map(([key, value]) => ({ key, value }))); if (error) throw error
}
// categories + filters (stored as one JSON text under the key "taxonomy" in site_settings, so no database change is needed)
export async function loadTaxonomy() {
  if (demo) return normTax(ls('hr_taxonomy', null))
  const { data, error } = await sb.from('site_settings').select('value').eq('key', 'taxonomy').maybeSingle()
  if (error) throw error
  return normTax(data && data.value)
}
export async function saveTaxonomy(t) {
  const clean = normTax(t)
  if (demo) { localStorage.setItem('hr_taxonomy', JSON.stringify(clean)); return clean }
  const { error } = await sb.from('site_settings').upsert({ key: 'taxonomy', value: JSON.stringify(clean) }); if (error) throw error
  return clean
}
export const auth = {
  session: async () => (demo ? null : (await sb.auth.getSession()).data.session),
  login: (email, password) => sb.auth.signInWithPassword({ email, password }),
  logout: () => sb.auth.signOut(),
  changePassword: (password) => sb.auth.updateUser({ password }),
}
