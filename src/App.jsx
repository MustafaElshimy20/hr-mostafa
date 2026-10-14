import { useEffect, useMemo, useRef, useState } from 'react'
import { FIELDS } from './fields'
import Admin from './Admin'
import * as api from './api'
import { SORTS, sortOffers, salaryLabel, gradsOnly } from './lib'
import { normTax, valuesOf, filterById, matches, facetCounts, levelRank, optLabel, relevance, tokens } from './taxonomy'
import { shareMessage } from './share'
import { tidy, toList, plainSalary } from './text'

const wa = (n, t = '') => `https://wa.me/${n}${t ? '?text=' + encodeURIComponent(t) : ''}`
const useHash = () => { const [h, s] = useState(location.hash); useEffect(() => { const f = () => { s(location.hash); scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, []); return h }
const offerLink = (o) => location.href.split('#')[0] + '#/offer/' + o.id
const areasOf = (o, tax) => { const f = filterById(tax, 'area'); return f ? valuesOf(o, f, tax) : [] }
const valOf = (o, tax, id) => { const f = filterById(tax, id); return f ? valuesOf(o, f, tax) : [] }
const shareHref = (o, tax, tpl) => 'https://wa.me/?text=' + encodeURIComponent(shareMessage(o, tax, tpl, offerLink(o)))
function Hl({ text, q }) { const ts = tokens(q || '').filter((t) => t.length > 1); if (!ts.length || !text) return text
  const re = new RegExp('(' + ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi')
  return String(text).split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p)) }
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
const EMPTY = { q: '', sel: {}, sort: 'new', saved: false }

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
        : id ? <Detail tax={tax} tpl={settings.share_template} o={offers.find((x) => x.id === id)} n={settings.whatsapp} loading={loading} saved={saved} toggleSave={toggleSave} />
        : <List tax={tax} tpl={settings.share_template} offers={open} settings={settings} loading={loading} saved={saved} toggleSave={toggleSave} f={f} setF={setF} page={page} setPage={setPage} />}
    </main>
    <footer className="wrap foot"><span>{settings.footer}</span><a href="#admin" className="adm">Admin</a></footer>
  </>)
}

function List({ tax, tpl, offers, settings, loading, saved, toggleSave, f, setF, page, setPage }) {
  const barRef = useRef(null), [fOpen, setFOpen] = useState(false) // filters are collapsible on phones
  const ctx = useMemo(() => ({ saved }), [saved])
  const pick = (fl, v) => { const sel = { ...f.sel, [fl.id]: v }; tax.filters.forEach((c) => { if (c.dependsOn === fl.id) delete sel[c.id] }); setF({ ...f, sel }) } // changing a parent (e.g. governorate) resets its children (area)
  const strict = useMemo(() => offers.filter((o) => matches(o, f, tax, ctx)), [offers, f, tax, ctx])
  const fuzzy = !!f.q && strict.length === 0 // nothing matches exactly -> also accept small typing mistakes
  const ff = useMemo(() => ({ ...f, fuzzy }), [f, fuzzy])
  const facets = useMemo(() => facetCounts(offers, ff, tax, ctx), [offers, ff, tax, ctx])
  const onKey = (e) => { if (e.key === 'Enter') e.target.blur() } // Enter closes the phone keyboard
  const langId = (tax.filters.find((x) => x.kind === 'level') || {}).langFilter
  const list = useMemo(() => {
    const lang = f.sel[langId]
    const base = fuzzy ? offers.filter((o) => matches(o, ff, tax, ctx)) : strict
    if (f.q && f.sort === 'new') return base.map((o, i) => [o, i, relevance(o, f.q, tax)]).sort((a, b) => b[2] - a[2] || a[1] - b[1]).map((x) => x[0]) // best match first
    return sortOffers(base, f.sort, (o) => levelRank(o, tax, lang))
  }, [offers, f, ff, fuzzy, strict, tax, ctx, langId])
  const shownFilters = tax.filters.filter((fl) => fl.visible && (fl.kind === 'level' || fl.options.length))
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE)), cur = Math.min(page, pages)
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE)
  const go = (p) => { setPage(p); setTimeout(() => barRef.current && barRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }
  const active = shownFilters.filter((fl) => f.sel[fl.id]) // the choices currently applied
  const dirty = !!(f.q || f.saved || Object.values(f.sel).some(Boolean))
  const lvl = tax.filters.find((x) => x.kind === 'level'), lvlSel = lvl && f.sel[lvl.id]
  return (<>
    <section className="hero"><h1>{settings.title}</h1><p>{settings.intro}</p>
      <div className="searchbox"><span className="mag" aria-hidden="true">🔍</span>
        <input className="big" type="search" autoComplete="off" aria-label="Search job offers" placeholder="Search jobs, companies, areas…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={onKey} />
        {f.q && <button className="clr" onClick={() => setF({ ...f, q: '' })} aria-label="Clear search">✕</button>}</div></section>
    <section className="fpanel" aria-label="Filters">
      <div className="fhead"><b>Filters</b>{active.length > 0 && <span className="fbadge">{active.length}</span>}<span className="grow" />
        {dirty && <button className="link" onClick={() => setF(EMPTY)}>Clear all</button>}
        <button className="btn sm ftoggle" aria-expanded={fOpen} onClick={() => setFOpen(!fOpen)}>{fOpen ? 'Hide filters' : 'Show filters'}</button></div>
      <div className={'filters' + (fOpen ? ' open' : '')}>
        {shownFilters.map((fl) => { const cur = f.sel[fl.id] || '', parent = fl.dependsOn && f.sel[fl.dependsOn]
          const opts = fl.options.filter((x) => !fl.dependsOn || !parent || x.parent === parent)
          return <select key={fl.id} aria-label={fl.label} className={cur ? 'set' : ''} value={cur} onChange={(e) => pick(fl, e.target.value)}>
            <option value="">{parent ? `All ${fl.label.toLowerCase()}${/s$/i.test(fl.label) ? '' : 's'} in ${parent}` : fl.label}</option>
            {opts.map((x) => { const n = (facets.opt[fl.id] || {})[x.v] || 0; return <option key={x.v} value={x.v} disabled={!n && x.v !== cur}>{optLabel(x)} ({n})</option> })}</select> })}</div>
      {active.length > 0 && <div className="applied">{active.map((fl) => { const x = fl.options.find((o) => o.v === f.sel[fl.id])
        return <button key={fl.id} className="achip" onClick={() => pick(fl, '')} title="Remove this filter">{fl.label}: <b>{x ? optLabel(x) : f.sel[fl.id]}</b> ✕</button> })}</div>}
    </section>
    {fuzzy && list.length > 0 && <p className="hint">No exact match for <b>“{f.q}”</b> — showing the closest matches.</p>}
    {lvlSel && <p className="hint">Showing offers that need level <b>{lvlSel}</b> or lower{f.sel[langId] ? ' in ' + f.sel[langId] : ''}. Offers that don't state a level are included.</p>}
    <div className="row bar" ref={barRef}>
      <div className="seg"><button className={!f.saved ? 'on' : ''} onClick={() => setF({ ...f, saved: false })}>All <small>{offers.length}</small></button>
        <button className={f.saved ? 'on heart' : 'heart'} onClick={() => setF({ ...f, saved: true })}>♥ Saved <small>{offers.filter((o) => saved.includes(o.id)).length}</small></button></div>
      <span className="muted" aria-live="polite">{loading ? 'Loading…' : list.length > PER_PAGE ? `Showing ${(cur - 1) * PER_PAGE + 1}–${Math.min(cur * PER_PAGE, list.length)} of ${list.length} offers` : `${list.length} offer${list.length === 1 ? '' : 's'} found`}</span>
      <span className="grow" />
      <select className="sortsel" aria-label="Sort offers" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>{SORTS.map(([v, l]) => <option key={v} value={v}>{v === 'new' && f.q ? 'Sort: best match' : l}</option>)}</select></div>
    <div className="grid">{shown.map((o) => <Card key={o.id} o={o} q={f.q} tax={tax} tpl={tpl} saved={saved.includes(o.id)} onSave={() => toggleSave(o.id)} />)}</div>
    {pages > 1 && <nav className="pager" aria-label="Pages">
      <button className="pg" disabled={cur === 1} onClick={() => go(cur - 1)}>‹ Prev</button>
      {pageList(cur, pages).map((p, i) => p === '…' ? <span key={'e' + i} className="dots">…</span>
        : <button key={p} className={p === cur ? 'pg on' : 'pg'} aria-current={p === cur ? 'page' : undefined} onClick={() => go(p)}>{p}</button>)}
      <button className="pg" disabled={cur === pages} onClick={() => go(cur + 1)}>Next ›</button>
      <span className="pinfo">Page {cur} of {pages}</span></nav>}
    {!loading && !list.length && <div className="empty">{f.saved && !saved.length ? 'You have not saved any offers yet. Tap the ♡ on any offer to keep it here.' : 'No offers match your search and filters.'}{dirty && <><br /><button className="btn sm" style={{ marginTop: 10 }} onClick={() => setF(EMPTY)}>Clear search & filters</button></>}</div>}
  </>)
}

function Card({ o, q, tax, tpl, saved, onSave }) {
  const sl = salaryLabel(o), pl = areasOf(o, tax), shift = valOf(o, tax, 'shift').join(' / '), work = valOf(o, tax, 'work').join(' / ')
  const where = pl.length > 2 ? `Multiple locations (${pl.length})` : pl.length ? pl.join(' / ') : (o.location || '').split(/[;(,]/)[0]
  const lang = !o.language ? '' : o.language.length > 34 ? 'Multiple languages' : o.language
  return (<div className="offer">
    <a className="stretch" href={'#/offer/' + o.id}>
      <span className="co"><Hl text={o.company} q={q} /></span><h3><Hl text={o.position} q={q} /></h3>
      <div className="money">{sl.text}{sl.type && <>{' '}<span className={'stype ' + sl.type.toLowerCase()}>{sl.type}</span></>}</div>
      <div className="tags"><span>📍 {where}</span>{lang && <span>🗣️ {lang}</span>}
        {shift && <span>{/rotat/i.test(shift) ? '🔄' : '🕐'} {shift}</span>}{work && <span>{/home|remote|wfh/i.test(work) ? '🏠' : /hybrid/i.test(work) ? '🔀' : '🏢'} {work}</span>}{gradsOnly(o) && <span>🎓 Graduates</span>}{/female/i.test(o.position) && <span>👩 Females only</span>}</div>
      <span className="more">View details →</span></a>
    <div className="acts">
      <a className="ico" href={shareHref(o, tax, tpl)} target="_blank" rel="noreferrer" title="Share on WhatsApp" aria-label="Share on WhatsApp">↗</a>
      <button className={saved ? 'ico on' : 'ico'} onClick={onSave} title={saved ? 'Remove from saved' : 'Save offer'} aria-label={saved ? 'Remove from saved' : 'Save offer'}>{saved ? '♥' : '♡'}</button>
    </div></div>)
}

// salary text with the Net / Gross word right after the figure, e.g. "12,000 Net + uncapped commission"

const SHORT = 48 // a value longer than this is not a "key detail"; it is shown in full in its section instead
function Row({ label, children }) { return <div className="drow"><dt>{label}</dt><dd>{children}</dd></div> }
function Items({ text, check, arrows }) { const l = toList(text, { arrows, sentences: !check && !arrows })
  if (arrows && l.length > 1) return <ol className="steps">{l.map((x, i) => <li key={i}>{x}</li>)}</ol>
  return l.length > 1 || check ? <ul className={check ? 'ticks' : 'bul'}>{l.map((x, i) => <li key={i}>{x}</li>)}</ul> : <>{l[0]}</> }

function Detail({ tax, tpl, o, n, loading, saved, toggleSave }) {
  const [copied, setCopied] = useState(false)
  if (!o) return <><a className="back" href="#">← All offers</a><p className="empty">{loading ? 'Loading…' : 'This offer is no longer available.'}</p></>
  const sl = salaryLabel(o), pl = areasOf(o, tax), shift = valOf(o, tax, 'shift').join(' / '), work = valOf(o, tax, 'work').join(' / ')
  const loc = tidy(o.location), lang = tidy(o.language), exp = tidy(o.experience)
  const locShort = loc && loc.length <= SHORT, langShort = lang && lang.length <= SHORT, expShort = exp && exp.length <= SHORT
  const hasSal = sl.text !== 'Salary on request'
  const key = [ // the highlighted details (each one appears once: long texts are summarised here and written in full below)
    ['💰', 'Salary', hasSal ? <>{sl.text}{sl.type && <>{' '}<span className={'stype in ' + sl.type.toLowerCase()}>{sl.type}</span></>}</> : 'On request', 'sal'],
    loc && ['📍', 'Location', locShort ? loc : pl.length > 1 ? `${pl.length} locations` : pl[0] || 'See details below'],
    lang && ['🗣️', 'Language', langShort ? lang : 'Multiple languages (see below)'],
    exp && ['🧑‍💼', 'Experience', expShort ? exp : 'See requirements below'],
  ].filter(Boolean)
  const msg = `Hello, I'd like to apply for: ${o.position} at ${o.company}${o.location ? ' (' + o.location.split(/[;(]/)[0].trim() + ')' : ''}`
  const apply = <a className="btn wa big block" target="_blank" rel="noreferrer" href={wa(n, msg)}>💬 Apply via WhatsApp</a>
  const Card = ({ icon, title, rows }) => { const r = rows.filter(Boolean); return r.length ? <section className="dcard"><h3><span className="ic" aria-hidden="true">{icon}</span>{title}</h3><dl>{r}</dl></section> : null }
  return (<>
    <a className="back" href="#">← All offers</a>
    <header className="dtitle"><span className="co">{o.company}</span><h1>{o.position}</h1>
      {o.status === 'Closed' && <p className="closedmsg">This offer is currently closed.</p>}</header>
    <div className="dlayout">
      <main className="dmain">
        <Card icon="💰" title="Salary & benefits" rows={[
          o.salary && (!plainSalary(o.salary) || !hasSal) && <Row key="s" label="Pay details"><Items text={o.salary} /></Row>,
          o.benefits && <Row key="b" label="Benefits"><Items text={o.benefits} check /></Row>,
          o.transport && <Row key="t" label="Transportation"><Items text={o.transport} /></Row>]} />
        <Card icon="🕐" title="Work & interview details" rows={[
          loc && !locShort && <Row key="l" label="Location"><Items text={o.location} /></Row>,
          o.shifts && <Row key="sh" label="Shifts"><Items text={o.shifts} /></Row>,
          (work || o.work_mode) && <Row key="w" label="Work mode">{work || o.work_mode}</Row>,
          o.interview_type && <Row key="it" label="Interview type"><Items text={o.interview_type} /></Row>,
          o.interview_time && <Row key="iti" label="Interview time"><Items text={o.interview_time} /></Row>]} />
        <Card icon="📋" title="Requirements" rows={[
          o.education && <Row key="e" label="Education"><Items text={o.education} /></Row>,
          o.age && <Row key="a" label="Age">{tidy(o.age)}</Row>,
          o.nationality && <Row key="na" label="Nationality">{tidy(o.nationality)}</Row>,
          o.military && <Row key="m" label="Military status">{tidy(o.military)}</Row>,
          exp && !expShort && <Row key="x" label="Experience"><Items text={o.experience} /></Row>,
          lang && !langShort && <Row key="lg" label="Language"><Items text={o.language} /></Row>]} />
        <Card icon="📝" title="How to apply" rows={[
          o.steps && <Row key="st" label="Steps"><Items text={o.steps} arrows /></Row>,
          o.notes && <Row key="no" label="Good to know"><Items text={o.notes} /></Row>]} />
      </main>
      <aside className="dside">
        <div className="keycard">
          <h2>Key details</h2>
          <ul>{key.map(([i, l, v, k]) => <li key={l} className={k}><span className="ki" aria-hidden="true">{i}</span><span><small>{l}</small><b>{v}</b></span></li>)}</ul>
          {shift || work ? <div className="tags">{shift && <span>{/rotat/i.test(shift) ? '🔄' : '🕐'} {shift}</span>}{work && <span>{/home|remote|wfh/i.test(work) ? '🏠' : /hybrid/i.test(work) ? '🔀' : '🏢'} {work}</span>}{gradsOnly(o) && <span>🎓 Graduates</span>}</div> : null}
          <div className="applybtn">{apply}</div>
          <div className="row dacts">
            <button className={saved.includes(o.id) ? 'btn sm on' : 'btn sm'} onClick={() => toggleSave(o.id)}>{saved.includes(o.id) ? '♥ Saved' : '♡ Save'}</button>
            <a className="btn sm" href={shareHref(o, tax, tpl)} target="_blank" rel="noreferrer">↗ Share</a>
            <button className="btn sm" onClick={() => navigator.clipboard.writeText(offerLink(o)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }, () => {})}>{copied ? 'Copied ✔' : '🔗 Copy link'}</button></div>
        </div>
      </aside>
    </div>
    <div className="sticky">{apply}</div>
  </>)
}
