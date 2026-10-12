import { useEffect, useMemo, useRef, useState } from 'react'
import { FIELDS } from './fields'
import Admin from './Admin'
import * as api from './api'
import { LANGS, LEVELS, GOVS, PLACES, EDU, WORK_MODES, INTERVIEWS, SORTS, low, placesOf, govsOf, levelOk, eduOk, workMode, interviewMode, sortOffers, searchText, salaryTypeOf, category, maxSalary, rotational, gradsOnly } from './lib'

const wa = (n, t = '') => `https://wa.me/${n}${t ? '?text=' + encodeURIComponent(t) : ''}`
const useHash = () => { const [h, s] = useState(location.hash); useEffect(() => { const f = () => { s(location.hash); scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, []); return h }
const offerLink = (o) => location.href.split('#')[0] + '#/offer/' + o.id
const shareText = (o) => { const m = maxSalary(o), pl = placesOf(o), st = salaryTypeOf(o)
  return `🔥 Job offer: ${o.position} at ${o.company}\n` + (m ? `💰 Up to ${m.toLocaleString()} EGP${st ? ' ' + st.toLowerCase() : ''}\n` : '') + (pl.length ? `📍 ${pl.slice(0, 2).map((p) => p[1]).join(' / ')}\n` : '') + `\nDetails & how to apply:\n${offerLink(o)}` }
const shareHref = (o) => 'https://wa.me/?text=' + encodeURIComponent(shareText(o))
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
const EMPTY = { q: '', cat: '', gov: '', area: '', lang: '', level: '', edu: '', shift: '', work: '', iv: '', sort: 'new', saved: false }

export default function App() {
  const [offers, setOffers] = useState([]), [settings, setSettings] = useState(api.DEFAULTS), [err, setErr] = useState('')
  const [session, setSession] = useState(null), [loading, setLoading] = useState(true), hash = useHash(), [saved, toggleSave] = useSaved()
  const [f, setFilters] = useState(EMPTY), [page, setPage] = useState(1)
  const setF = (n) => { setFilters(n); setPage(1) } // any filter change goes back to page 1
  const reload = async () => { try { setOffers(await api.loadOffers()); setSettings(await api.loadSettings()) } catch (e) { setErr(e.message) } setLoading(false) }
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
      {isAdmin ? <Admin {...{ offers, settings, session, reload }} />
        : id ? <Detail o={offers.find((x) => x.id === id)} n={settings.whatsapp} loading={loading} saved={saved} toggleSave={toggleSave} />
        : <List offers={open} settings={settings} loading={loading} saved={saved} toggleSave={toggleSave} f={f} setF={setF} page={page} setPage={setPage} />}
    </main>
    <footer className="wrap foot"><span>{settings.footer}</span><a href="#admin" className="adm">Admin</a></footer>
  </>)
}

function List({ offers, settings, loading, saved, toggleSave, f, setF, page, setPage }) {
  const barRef = useRef(null)
  const set = (k) => (e) => setF({ ...f, [k]: e && e.target ? e.target.value : e })
  const cats = useMemo(() => { const m = {}; offers.forEach((o) => { const c = category(o); m[c] = (m[c] || 0) + 1 }); return m }, [offers])
  const areas = PLACES.filter((p) => !f.gov || p[0] === f.gov)
  const list = useMemo(() => {
    const ks = f.area && PLACES.find((p) => p[1] === f.area)[2]
    const r = offers.filter((o) => (!f.cat || category(o) === f.cat) && (!f.gov || govsOf(o).has(f.gov)) && (!ks || ks.some((k) => low(o.location).includes(k))) &&
      (!f.lang || (o.language || '').includes(f.lang)) && levelOk(o, f.lang, f.level) &&
      eduOk(o, f.edu) && (!f.shift || (f.shift === 'rot') === rotational(o)) && (!f.work || workMode(o) === f.work) && (!f.iv || interviewMode(o) === f.iv) &&
      (!f.saved || saved.includes(o.id)) && (!f.q || low(searchText(o)).includes(low(f.q))))
    return sortOffers(r, f.sort, f.lang)
  }, [offers, f, saved])
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE)), cur = Math.min(page, pages)
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE)
  const go = (p) => { setPage(p); setTimeout(() => barRef.current && barRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }
  const dirty = Object.entries(f).some(([k, v]) => k !== 'sort' && v)
  return (<>
    <section className="hero"><h1>{settings.title}</h1><p>{settings.intro}</p>
      <input className="big" placeholder="🔍 Search by company, job, area, language…" value={f.q} onChange={set('q')} /></section>
    <div className="chips"><button className={!f.cat && !f.saved ? 'chip on' : 'chip'} onClick={() => setF({ ...f, cat: '', saved: false })}>All <small>{offers.length}</small></button>
      <button className={f.saved ? 'chip on heart' : 'chip heart'} onClick={() => setF({ ...f, saved: !f.saved })}>♥ Saved <small>{offers.filter((o) => saved.includes(o.id)).length}</small></button>
      {Object.entries(cats).map(([c, n]) => <button key={c} className={f.cat === c ? 'chip on' : 'chip'} onClick={() => setF({ ...f, cat: c, saved: false })}>{c} <small>{n}</small></button>)}</div>
    <div className="filters">
      <select value={f.gov} onChange={(e) => setF({ ...f, gov: e.target.value, area: '' })}><option value="">Governorate</option>{GOVS.map((g) => <option key={g}>{g}</option>)}</select>
      <select value={f.area} onChange={set('area')}><option value="">{f.gov ? 'All areas in ' + f.gov : 'Area'}</option>{areas.map((a) => <option key={a[1]}>{a[1]}</option>)}</select>
      <select value={f.lang} onChange={set('lang')}><option value="">Language</option>{LANGS.map((l) => <option key={l}>{l}</option>)}</select>
      <select value={f.level} onChange={set('level')}><option value="">My language level</option>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select value={f.edu} onChange={set('edu')}><option value="">Education status</option>{EDU.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select value={f.shift} onChange={set('shift')}><option value="">Shift type</option><option value="fix">Fixed shift</option><option value="rot">Rotational</option></select>
      <select value={f.work} onChange={set('work')}><option value="">Work mode</option>{WORK_MODES.map((m) => <option key={m}>{m}</option>)}</select>
      <select value={f.iv} onChange={set('iv')}><option value="">Interview type</option>{INTERVIEWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
    {f.level && <p className="hint">Showing offers that need level <b>{f.level}</b> or lower{f.lang ? ' in ' + f.lang : ''}. Offers that don't state a level are included.</p>}
    <div className="row bar" ref={barRef}><span className="muted">{loading ? 'Loading…' : list.length > PER_PAGE ? `Showing ${(cur - 1) * PER_PAGE + 1}–${Math.min(cur * PER_PAGE, list.length)} of ${list.length} offers` : `${list.length} offers found`}</span>
      <span className="grow" />{dirty && <button className="link" onClick={() => setF(EMPTY)}>Clear filters</button>}
      <select className="sortsel" aria-label="Sort offers" value={f.sort} onChange={set('sort')}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
    <div className="grid">{shown.map((o) => <Card key={o.id} o={o} saved={saved.includes(o.id)} onSave={() => toggleSave(o.id)} />)}</div>
    {pages > 1 && <nav className="pager" aria-label="Pages">
      <button className="pg" disabled={cur === 1} onClick={() => go(cur - 1)}>‹ Prev</button>
      {pageList(cur, pages).map((p, i) => p === '…' ? <span key={'e' + i} className="dots">…</span>
        : <button key={p} className={p === cur ? 'pg on' : 'pg'} aria-current={p === cur ? 'page' : undefined} onClick={() => go(p)}>{p}</button>)}
      <button className="pg" disabled={cur === pages} onClick={() => go(cur + 1)}>Next ›</button>
      <span className="pinfo">Page {cur} of {pages}</span></nav>}
    {!loading && !list.length && <p className="empty">{f.saved && !saved.length ? 'You have not saved any offers yet. Tap the ♡ on any offer to keep it here.' : 'No offers match these filters. Try clearing some filters.'}</p>}
  </>)
}

function Card({ o, saved, onSave }) {
  const m = maxSalary(o), pl = placesOf(o), st = salaryTypeOf(o)
  const where = pl.length > 2 ? `Multiple locations (${pl.length})` : pl.length ? pl.map((p) => p[1]).join(' / ') : (o.location || '').split(/[;(,]/)[0]
  const lang = !o.language ? '' : o.language.length > 34 ? 'Multiple languages' : o.language
  return (<div className="offer">
    <a className="stretch" href={'#/offer/' + o.id}>
      <span className="co">{o.company}</span><h3>{o.position}</h3>
      <div className="money">{m ? `Up to ${m.toLocaleString()} EGP` : o.salary ? o.salary.slice(0, 40) : 'Salary on request'}{st && <span className={'stype ' + st.toLowerCase()}>{st}</span>}</div>
      <div className="tags"><span>📍 {where}</span>{lang && <span>🗣️ {lang}</span>}
        <span>{rotational(o) ? '🔄 Rotational' : '🕐 Fixed shift'}</span><span>{{ 'On-site': '🏢 On-site', 'Work from home': '🏠 Work from home', Hybrid: '🔀 Hybrid' }[workMode(o)]}</span>{gradsOnly(o) && <span>🎓 Graduates</span>}{/female/i.test(o.position) && <span>👩 Females only</span>}</div>
      <span className="more">View details →</span></a>
    <div className="acts">
      <a className="ico" href={shareHref(o)} target="_blank" rel="noreferrer" title="Share on WhatsApp" aria-label="Share on WhatsApp">↗</a>
      <button className={saved ? 'ico on' : 'ico'} onClick={onSave} title={saved ? 'Remove from saved' : 'Save offer'} aria-label={saved ? 'Remove from saved' : 'Save offer'}>{saved ? '♥' : '♡'}</button>
    </div></div>)
}

function Detail({ o, n, loading, saved, toggleSave }) {
  const [copied, setCopied] = useState(false)
  if (!o) return <><a className="back" href="#">← All offers</a><p className="empty">{loading ? 'Loading…' : 'This offer is no longer available.'}</p></>
  const Sec = ({ t, keys }) => { const rows = keys.map((k) => [FIELDS.find((x) => x[0] === k)[1], k === 'work_mode' ? workMode(o) : k === 'salary_type' ? salaryTypeOf(o) : o[k]]).filter((r) => r[1])
    return rows.length ? <section className="card"><h3>{t}</h3><dl>{rows.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl></section> : null }
  const msg = `Hello, I'd like to apply for: ${o.position} at ${o.company}${o.location ? ' (' + o.location.split(/[;(]/)[0].trim() + ')' : ''}`
  return (<>
    <a className="back" href="#">← All offers</a>
    <div className="dhead"><span className="co">{o.company}</span><h1>{o.position}</h1>
      <div className="tags"><span>📍 {o.location}</span>{o.language && <span>🗣️ {o.language}</span>}</div>
      <a className="btn wa big" target="_blank" rel="noreferrer" href={wa(n, msg)}>💬 Apply on WhatsApp</a>
      <div className="row dacts">
        <button className={saved.includes(o.id) ? 'btn on' : 'btn'} onClick={() => toggleSave(o.id)}>{saved.includes(o.id) ? '♥ Saved' : '♡ Save'}</button>
        <a className="btn" href={shareHref(o)} target="_blank" rel="noreferrer">↗ Share on WhatsApp</a>
        <button className="btn" onClick={() => navigator.clipboard.writeText(offerLink(o)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }, () => {})}>{copied ? 'Copied ✔' : '🔗 Copy link'}</button>
      </div></div>
    <Sec t="Salary & benefits" keys={['salary', 'salary_type', 'benefits', 'transport']} />
    <Sec t="Schedule" keys={['shifts', 'work_mode', 'interview_type', 'interview_time']} />
    <Sec t="Requirements" keys={['education', 'age', 'nationality', 'military', 'experience', 'language']} />
    <Sec t="More info" keys={['steps', 'notes']} />
    <div className="sticky"><a className="btn wa big" target="_blank" rel="noreferrer" href={wa(n, msg)}>💬 Apply on WhatsApp</a></div>
  </>)
}

