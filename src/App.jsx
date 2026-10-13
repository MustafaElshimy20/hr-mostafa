import { useEffect, useMemo, useRef, useState } from 'react'
import { FIELDS } from './fields'
import Admin from './Admin'
import * as api from './api'
import { SORTS, sortOffers, salaryLabel, gradsOnly } from './lib'
import { normTax, valuesOf, filterById, matches, facetCounts, allCategories, categoryOf, levelRank, optLabel } from './taxonomy'

const wa = (n, t = '') => `https://wa.me/${n}${t ? '?text=' + encodeURIComponent(t) : ''}`
const useHash = () => { const [h, s] = useState(location.hash); useEffect(() => { const f = () => { s(location.hash); scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, []); return h }
const offerLink = (o) => location.href.split('#')[0] + '#/offer/' + o.id
const areasOf = (o, tax) => { const f = filterById(tax, 'area'); return f ? valuesOf(o, f, tax) : [] }
const valOf = (o, tax, id) => { const f = filterById(tax, id); return f ? valuesOf(o, f, tax) : [] }
const shareText = (o, tax) => { const sl = salaryLabel(o), pl = areasOf(o, tax)
  return `🔥 Job offer: ${o.position} at ${o.company}\n` + (sl.text !== 'Salary on request' ? `💰 ${sl.text}${sl.type ? ' ' + sl.type.toLowerCase() : ''}\n` : '') + (pl.length ? `📍 ${pl.slice(0, 2).join(' / ')}\n` : '') + `\nDetails & how to apply:\n${offerLink(o)}` }
const shareHref = (o, tax) => 'https://wa.me/?text=' + encodeURIComponent(shareText(o, tax))
function useSaved() {
  const [ids, setIds] = useState(() => { try { return JSON.parse(localStorage.getItem('hr_saved') || '[]') } catch { return [] } })
  const toggle = (id) => setIds((p) => { const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]; try { localStorage.setItem('hr_saved', JSON.stringify(n)) } catch {} return n })
  return [ids, toggle]
}
const PER_PAGE = 12
function pageList(cur, pages) {
  const set = new Set([1, pages, cur - 1, cur, cur + 1]); if (cur <= 3) [2, 3, 4].forEach((x) => set.add(x)); if (cur >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((x) => set.add(x))
  const nums = [...set].filter((x) => x >= 1 && x <= pages).sort((a, b) => a - b), out = []
  nums.forEach((x, i) => { if (i && x - nums[i - 1] > 1) out.push('…'); out.push(x) }); return out
}
const EMPTY = { q: '', cat: '', sel: {}, sort: 'new', saved: false }

export default function App() {
  const [offers, setOffers] = useState([]), [tax, setTax] = useState(() => normTax(null)), [settings, setSettings] = useState(api.DEFAULTS), [err, setErr] = useState('')
  const [session, setSession] = useState(null), [loading, setLoading] = useState(true), hash = useHash(), [saved, toggleSave] = useSaved()
  const [f, setFilters] = useState(EMPTY), [page, setPage] = useState(1)
  const setF = (n) => { setFilters(n); setPage(1) } // any filter change goes back to page 1
  const reload = async () => { try { setOffers(await api.loadOffers()); setSettings(await api.loadSettings()); setTax(await api.loadTaxonomy()) } catch (e) { setErr(e.message) } setLoading(false) }
  useEffect(() => { reload(); api.auth.session().then(setSession); if (api.sb) api.sb.auth.onAuthStateChange((_e, s) => setSession(s)) }, [])
  useEffect(() => { document.title = settings.title + ' – Job Offers' }, [settings.title])
  const isAdmin = hash === '#admin', id = hash.startsWith('#/offer/') ? hash.slice(8) : null
  const open = offers.filter((o) => o.status !== 'Closed')
  return (<>
    <header className="top"><div className="wrap row"><a className="brand" href="#">{settings.title}</a><span className="grow" />
      <a className="btn wa" href={wa(settings.whatsapp)} target="_blank" rel="noreferrer">💬 Chat on WhatsApp</a></div></header>
    {settings.banner && !isAdmin && <div className="banner"><div className="wrap">{settings.banner}</div></div>}
    <main className="wrap">
      {err && <p className="err">{err}</p>}
      {isAdmin ? <Admin {...{ offers, settings, tax, session, reload }} />
        : id ? <Detail tax={tax} o={offers.find((x) => x.id === id)} n={settings.whatsapp} loading={loading} saved={saved} toggleSave={toggleSave} />
        : <List tax={tax} offers={open} settings={settings} loading={loading} saved={saved} toggleSave={toggleSave} f={f} setF={setF} page={page} setPage={setPage} />}
    </main>
    <footer className="wrap foot"><span>{settings.footer}</span><a href="#admin" className="adm">Admin</a></footer>
  </>)
}

function List({ tax, offers, settings, loading, saved, toggleSave, f, setF, page, setPage }) {
  const barRef = useRef(null)
  const ctx = useMemo(() => ({ saved }), [saved])
  const setQ = (e) => setF({ ...f, q: e.target.value })
  const setSort = (e) => setF({ ...f, sort: e.target.value })
  const pick = (fl, v) => { const sel = { ...f.sel, [fl.id]: v }; tax.filters.forEach((c) => { if (c.dependsOn === fl.id) delete sel[c.id] }); setF({ ...f, sel }) } // changing a parent (e.g. governorate) resets its children (area)
  const facets = useMemo(() => facetCounts(offers, f, tax, ctx), [offers, f, tax, ctx])
  const cats = useMemo(() => allCategories(offers, tax).filter((c) => offers.some((o) => categoryOf(o, tax) === c)), [offers, tax]) // a category with no open offers is hidden
  const langId = (tax.filters.find((x) => x.kind === 'level') || {}).langFilter
  const list = useMemo(() => {
    const lang = f.sel[langId]
    return sortOffers(offers.filter((o) => matches(o, f, tax, ctx)), f.sort, (o) => levelRank(o, tax, lang))
  }, [offers, f, tax, ctx, langId])
  const shown_filters = tax.filters.filter((fl) => fl.visible && (fl.kind === 'level' || fl.options.length))
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE)), cur = Math.min(page, pages)
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE)
  const go = (p) => { setPage(p); setTimeout(() => barRef.current && barRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }
  const dirty = !!(f.q || f.cat || f.saved || Object.values(f.sel).some(Boolean))
  const lvl = tax.filters.find((x) => x.kind === 'level'), lvlSel = lvl && f.sel[lvl.id]
  return (<>
    <section className="hero"><h1>{settings.title}</h1><p>{settings.intro}</p>
      <input className="big" placeholder="🔍 Search by company, job, area, language…" value={f.q} onChange={setQ} /></section>
    <div className="chips"><button className={!f.cat && !f.saved ? 'chip on' : 'chip'} onClick={() => setF({ ...f, cat: '', saved: false })}>All <small>{facets.all}</small></button>
      <button className={f.saved ? 'chip on heart' : 'chip heart'} onClick={() => setF({ ...f, saved: !f.saved })}>♥ Saved <small>{offers.filter((o) => saved.includes(o.id)).length}</small></button>
      {cats.map((c) => <button key={c} className={f.cat === c ? 'chip on' : 'chip'} onClick={() => setF({ ...f, cat: c, saved: false })}>{c} <small>{facets.cat[c] || 0}</small></button>)}</div>
    <div className="filters">
      {shown_filters.map((fl) => { const cur = f.sel[fl.id] || '', parent = fl.dependsOn && f.sel[fl.dependsOn]
        const opts = fl.options.filter((x) => !fl.dependsOn || !parent || x.parent === parent)
        return <select key={fl.id} aria-label={fl.label} value={cur} onChange={(e) => pick(fl, e.target.value)}>
          <option value="">{parent ? `All ${fl.label.toLowerCase()}${/s$/i.test(fl.label) ? '' : 's'} in ${parent}` : fl.label}</option>
          {opts.map((x) => { const n = (facets.opt[fl.id] || {})[x.v] || 0; return <option key={x.v} value={x.v} disabled={!n && x.v !== cur}>{optLabel(x)} ({n})</option> })}</select> })}</div>
    {lvlSel && <p className="hint">Showing offers that need level <b>{lvlSel}</b> or lower{f.sel[langId] ? ' in ' + f.sel[langId] : ''}. Offers that don't state a level are included.</p>}
    <div className="row bar" ref={barRef}><span className="muted">{loading ? 'Loading…' : list.length > PER_PAGE ? `Showing ${(cur - 1) * PER_PAGE + 1}–${Math.min(cur * PER_PAGE, list.length)} of ${list.length} offers` : `${list.length} offers found`}</span>
      <span className="grow" />{dirty && <button className="link" onClick={() => setF(EMPTY)}>Clear filters</button>}
      <select className="sortsel" aria-label="Sort offers" value={f.sort} onChange={setSort}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
    <div className="grid">{shown.map((o) => <Card key={o.id} o={o} tax={tax} saved={saved.includes(o.id)} onSave={() => toggleSave(o.id)} />)}</div>
    {pages > 1 && <nav className="pager" aria-label="Pages">
      <button className="pg" disabled={cur === 1} onClick={() => go(cur - 1)}>‹ Prev</button>
      {pageList(cur, pages).map((p, i) => p === '…' ? <span key={'e' + i} className="dots">…</span>
        : <button key={p} className={p === cur ? 'pg on' : 'pg'} aria-current={p === cur ? 'page' : undefined} onClick={() => go(p)}>{p}</button>)}
      <button className="pg" disabled={cur === pages} onClick={() => go(cur + 1)}>Next ›</button>
      <span className="pinfo">Page {cur} of {pages}</span></nav>}
    {!loading && !list.length && <p className="empty">{f.saved && !saved.length ? 'You have not saved any offers yet. Tap the ♡ on any offer to keep it here.' : 'No offers match these filters. Try clearing some filters.'}</p>}
  </>)
}

function Card({ o, tax, saved, onSave }) {
  const sl = salaryLabel(o), pl = areasOf(o, tax), shift = valOf(o, tax, 'shift').join(' / '), work = valOf(o, tax, 'work').join(' / ')
  const where = pl.length > 2 ? `Multiple locations (${pl.length})` : pl.length ? pl.join(' / ') : (o.location || '').split(/[;(,]/)[0]
  const lang = !o.language ? '' : o.language.length > 34 ? 'Multiple languages' : o.language
  return (<div className="offer">
    <a className="stretch" href={'#/offer/' + o.id}>
      <span className="co">{o.company}</span><h3>{o.position}</h3>
      <div className="money">{sl.text}{sl.type && <>{' '}<span className={'stype ' + sl.type.toLowerCase()}>{sl.type}</span></>}</div>
      <div className="tags"><span>📍 {where}</span>{lang && <span>🗣️ {lang}</span>}
        {shift && <span>{/rotat/i.test(shift) ? '🔄' : '🕐'} {shift}</span>}{work && <span>{/home|remote|wfh/i.test(work) ? '🏠' : /hybrid/i.test(work) ? '🔀' : '🏢'} {work}</span>}{gradsOnly(o) && <span>🎓 Graduates</span>}{/female/i.test(o.position) && <span>👩 Females only</span>}</div>
      <span className="more">View details →</span></a>
    <div className="acts">
      <a className="ico" href={shareHref(o, tax)} target="_blank" rel="noreferrer" title="Share on WhatsApp" aria-label="Share on WhatsApp">↗</a>
      <button className={saved ? 'ico on' : 'ico'} onClick={onSave} title={saved ? 'Remove from saved' : 'Save offer'} aria-label={saved ? 'Remove from saved' : 'Save offer'}>{saved ? '♥' : '♡'}</button>
    </div></div>)
}

// salary text with the Net / Gross word right after the figure, e.g. "12,000 Net + uncapped commission"

function Detail({ tax, o, n, loading, saved, toggleSave }) {
  const [copied, setCopied] = useState(false)
  if (!o) return <><a className="back" href="#">← All offers</a><p className="empty">{loading ? 'Loading…' : 'This offer is no longer available.'}</p></>
  const Sec = ({ t, keys }) => { const rows = keys.map((k) => [k, FIELDS.find((x) => x[0] === k)[1], k === 'work_mode' ? (valOf(o, tax, 'work').join(' / ') || o[k]) : o[k]]).filter((r) => r[2])
    return rows.length ? <section className="card"><h3>{t}</h3><dl>{rows.map(([k, l, v]) => <div key={k}><dt>{l}</dt><dd>{v}</dd></div>)}</dl></section> : null }
  const msg = `Hello, I'd like to apply for: ${o.position} at ${o.company}${o.location ? ' (' + o.location.split(/[;(]/)[0].trim() + ')' : ''}`
  return (<>
    <a className="back" href="#">← All offers</a>
    <div className="dhead"><span className="co">{o.company}</span><h1>{o.position}</h1>
      <div className="tags"><span>📍 {o.location}</span>{o.language && <span>🗣️ {o.language}</span>}</div>
      <a className="btn wa big" target="_blank" rel="noreferrer" href={wa(n, msg)}>💬 Apply on WhatsApp</a>
      <div className="row dacts">
        <button className={saved.includes(o.id) ? 'btn on' : 'btn'} onClick={() => toggleSave(o.id)}>{saved.includes(o.id) ? '♥ Saved' : '♡ Save'}</button>
        <a className="btn" href={shareHref(o, tax)} target="_blank" rel="noreferrer">↗ Share on WhatsApp</a>
        <button className="btn" onClick={() => navigator.clipboard.writeText(offerLink(o)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }, () => {})}>{copied ? 'Copied ✔' : '🔗 Copy link'}</button>
      </div></div>
    <Sec t="Salary & benefits" keys={['salary', 'benefits', 'transport']} />
    <Sec t="Schedule" keys={['shifts', 'work_mode', 'interview_type', 'interview_time']} />
    <Sec t="Requirements" keys={['education', 'age', 'nationality', 'military', 'experience', 'language']} />
    <Sec t="More info" keys={['steps', 'notes']} />
    <div className="sticky"><a className="btn wa big" target="_blank" rel="noreferrer" href={wa(n, msg)}>💬 Apply on WhatsApp</a></div>
  </>)
}

