import { useEffect, useMemo, useState } from 'react'
import { FIELDS, SETTINGS } from './fields'
import * as api from './api'
import { LANGS, LEVELS, GOVS, PLACES, low, placesOf, govsOf, levelOk, category, maxSalary, rotational, gradsOnly, langLevels } from './lib'

const wa = (n, t = '') => `https://wa.me/${n}${t ? '?text=' + encodeURIComponent(t) : ''}`
const useHash = () => { const [h, s] = useState(location.hash); useEffect(() => { const f = () => { s(location.hash); scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, []); return h }
const EMPTY = { q: '', cat: '', gov: '', area: '', lang: '', level: '', edu: '', shift: '', sort: 'new' }

export default function App() {
  const [offers, setOffers] = useState([]), [settings, setSettings] = useState(api.DEFAULTS), [err, setErr] = useState('')
  const [session, setSession] = useState(null), [loading, setLoading] = useState(true), hash = useHash()
  const reload = async () => { try { setOffers(await api.loadOffers()); setSettings(await api.loadSettings()) } catch (e) { setErr(e.message) } setLoading(false) }
  useEffect(() => { reload(); api.auth.session().then(setSession); if (api.sb) api.sb.auth.onAuthStateChange((_e, s) => setSession(s)) }, [])
  useEffect(() => { document.title = settings.title + ' – Job Offers' }, [settings.title])
  const isAdmin = hash === '#admin', id = hash.startsWith('#/offer/') ? hash.slice(8) : null
  const open = offers.filter((o) => o.status !== 'Closed')
  return (<>
    <header className="top"><div className="wrap row"><a className="brand" href="#">{settings.title}</a><span className="grow" />
      <a className="btn wa" href={wa(settings.whatsapp)} target="_blank" rel="noreferrer">💬 Chat on WhatsApp</a></div></header>
    <main className="wrap">
      {err && <p className="err">{err}</p>}
      {isAdmin ? <><a className="back" href="#">← Back to offers</a><Admin {...{ offers, settings, session, reload }} /></>
        : id ? <Detail o={offers.find((x) => x.id === id)} n={settings.whatsapp} loading={loading} />
        : <List offers={open} settings={settings} loading={loading} />}
    </main>
    <footer className="wrap foot"><span>{settings.footer}</span><a href="#admin" className="adm">Admin</a></footer>
  </>)
}

function List({ offers, settings, loading }) {
  const [f, setF] = useState(EMPTY)
  const set = (k) => (e) => setF({ ...f, [k]: e && e.target ? e.target.value : e })
  const cats = useMemo(() => { const m = {}; offers.forEach((o) => { const c = category(o); m[c] = (m[c] || 0) + 1 }); return m }, [offers])
  const areas = PLACES.filter((p) => !f.gov || p[0] === f.gov)
  const list = useMemo(() => {
    const ks = f.area && PLACES.find((p) => p[1] === f.area)[2]
    const r = offers.filter((o) => (!f.cat || category(o) === f.cat) && (!f.gov || govsOf(o).has(f.gov)) && (!ks || ks.some((k) => low(o.location).includes(k))) &&
      (!f.lang || (o.language || '').includes(f.lang)) && levelOk(o, f.lang, f.level) &&
      (!f.edu || (f.edu === 'grads' ? gradsOnly(o) : !gradsOnly(o))) && (!f.shift || (f.shift === 'rot') === rotational(o)) &&
      (!f.q || low(Object.values(o).join(' ')).includes(low(f.q))))
    return f.sort === 'sal' ? [...r].sort((a, b) => maxSalary(b) - maxSalary(a)) : r
  }, [offers, f])
  const dirty = Object.entries(f).some(([k, v]) => k !== 'sort' && v)
  return (<>
    <section className="hero"><h1>{settings.title}</h1><p>{settings.intro}</p>
      <input className="big" placeholder="🔍 Search by company, job, area, language…" value={f.q} onChange={set('q')} /></section>
    <div className="chips"><button className={!f.cat ? 'chip on' : 'chip'} onClick={() => set('cat')('')}>All <small>{offers.length}</small></button>
      {Object.entries(cats).map(([c, n]) => <button key={c} className={f.cat === c ? 'chip on' : 'chip'} onClick={() => set('cat')(c)}>{c} <small>{n}</small></button>)}</div>
    <div className="filters">
      <select value={f.gov} onChange={(e) => setF({ ...f, gov: e.target.value, area: '' })}><option value="">Governorate</option>{GOVS.map((g) => <option key={g}>{g}</option>)}</select>
      <select value={f.area} onChange={set('area')}><option value="">{f.gov ? 'All areas in ' + f.gov : 'Area'}</option>{areas.map((a) => <option key={a[1]}>{a[1]}</option>)}</select>
      <select value={f.lang} onChange={set('lang')}><option value="">Language</option>{LANGS.map((l) => <option key={l}>{l}</option>)}</select>
      <select value={f.level} onChange={set('level')}><option value="">My language level</option>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select value={f.edu} onChange={set('edu')}><option value="">Education</option><option value="grads">Graduates only</option><option value="open">Students / dropouts welcome</option></select>
      <select value={f.shift} onChange={set('shift')}><option value="">Shift type</option><option value="fix">Fixed shift</option><option value="rot">Rotational</option></select>
      <select value={f.sort} onChange={set('sort')}><option value="new">Sort: default</option><option value="sal">Sort: highest salary</option></select></div>
    {f.level && <p className="hint">Showing offers that need level <b>{f.level}</b> or lower{f.lang ? ' in ' + f.lang : ''}. Offers that don't state a level are included.</p>}
    <div className="row bar"><span className="muted">{loading ? 'Loading…' : `${list.length} offers found`}</span>
      {dirty && <button className="link" onClick={() => setF(EMPTY)}>Clear filters</button>}</div>
    <div className="grid">{list.map((o) => <Card key={o.id} o={o} />)}</div>
    {!loading && !list.length && <p className="empty">No offers match these filters. Try clearing some filters.</p>}
  </>)
}

function Card({ o }) {
  const m = maxSalary(o), pl = placesOf(o), lv = langLevels(o)
  const where = pl.length > 2 ? `Multiple locations (${pl.length})` : pl.length ? pl.map((p) => p[1]).join(' / ') : (o.location || '').split(/[;(,]/)[0]
  const lang = !o.language ? '' : o.language.length > 34 ? 'Multiple languages' : o.language
  return (<a className="offer" href={'#/offer/' + o.id}>
    <span className="co">{o.company}</span><h3>{o.position}</h3>
    <div className="money">{m ? `Up to ${m.toLocaleString()} EGP` : o.salary ? o.salary.slice(0, 40) : 'Salary on request'}</div>
    <div className="tags"><span>📍 {where}</span>{lang && <span>🗣️ {lang}</span>}
      <span>{rotational(o) ? '🔄 Rotational' : '🕐 Fixed shift'}</span>{gradsOnly(o) && <span>🎓 Graduates</span>}{/female/i.test(o.position) && <span>👩 Females only</span>}</div>
    <span className="more">View details →</span></a>)
}

function Detail({ o, n, loading }) {
  if (!o) return <><a className="back" href="#">← All offers</a><p className="empty">{loading ? 'Loading…' : 'This offer is no longer available.'}</p></>
  const Sec = ({ t, keys }) => { const rows = keys.map((k) => [FIELDS.find((x) => x[0] === k)[1], o[k]]).filter((r) => r[1])
    return rows.length ? <section className="card"><h3>{t}</h3><dl>{rows.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl></section> : null }
  const msg = `Hello, I'd like to apply for: ${o.position} at ${o.company}${o.location ? ' (' + o.location.split(/[;(]/)[0].trim() + ')' : ''}`
  return (<>
    <a className="back" href="#">← All offers</a>
    <div className="dhead"><span className="co">{o.company}</span><h1>{o.position}</h1>
      <div className="tags"><span>📍 {o.location}</span>{o.language && <span>🗣️ {o.language}</span>}</div>
      <a className="btn wa big" target="_blank" rel="noreferrer" href={wa(n, msg)}>💬 Apply on WhatsApp</a></div>
    <Sec t="Salary & benefits" keys={['salary', 'benefits', 'transport']} />
    <Sec t="Schedule" keys={['shifts', 'interview_type', 'interview_time']} />
    <Sec t="Requirements" keys={['education', 'age', 'nationality', 'military', 'experience', 'language']} />
    <Sec t="More info" keys={['steps', 'notes']} />
    <div className="sticky"><a className="btn wa big" target="_blank" rel="noreferrer" href={wa(n, msg)}>💬 Apply on WhatsApp</a></div>
  </>)
}

function Admin({ offers, settings, session, reload }) {
  const [edit, setEdit] = useState(null), [s, setS] = useState(settings), [msg, setMsg] = useState('')
  useEffect(() => setS(settings), [settings])
  const run = async (fn, ok) => { try { await fn(); await reload(); setMsg(ok) } catch (e) { setMsg('Error: ' + e.message) } setTimeout(() => setMsg(''), 3000) }
  if (!api.demo && !session) return <Login />
  return (<>
    <div className="row"><h2 className="grow">Admin</h2>{!api.demo && <button className="btn" onClick={api.auth.logout}>Sign out</button>}</div>
    {api.demo && <p className="note">Demo mode: changes are saved only in this browser. Add Supabase keys to save online (see README).</p>}
    {msg && <p className="note">{msg}</p>}
    <section className="card"><h3>Site text</h3>
      {SETTINGS.map(([k, l, long]) => <label key={k}>{l}{long ? <textarea value={s[k] || ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} /> : <input value={s[k] || ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} />}</label>)}
      <button className="btn pri" onClick={() => run(() => api.saveSettings(s), 'Text saved ✔')}>Save text</button></section>
    {edit ? <Form o={edit} onCancel={() => setEdit(null)} onSave={(o) => run(() => api.saveOffer(o).then(() => setEdit(null)), 'Offer saved ✔')} /> : <>
      <div className="row"><h3 className="grow">Offers ({offers.length})</h3>
        {!api.demo && !offers.length && <button className="btn" onClick={() => run(api.importStarter, 'Starter offers loaded ✔')}>Load starter offers</button>}
        <button className="btn pri" onClick={() => setEdit({ status: 'Open' })}>+ New offer</button></div>
      {offers.map((o) => <div className={'card row ' + (o.status === 'Closed' ? 'closed' : '')} key={o.id}>
        <div className="grow"><span className="co">{o.company}</span><b> {o.position}</b>{o.status === 'Closed' && <em> (closed)</em>}</div>
        <button className="btn" onClick={() => setEdit(o)}>Edit</button>
        <button className="btn del" onClick={() => confirm('Delete this offer?') && run(() => api.deleteOffer(o.id), 'Deleted ✔')}>Delete</button></div>)}
    </>}
  </>)
}

function Form({ o, onSave, onCancel }) {
  const [v, setV] = useState(o)
  return (<section className="card"><h3>{o.id ? 'Edit offer' : 'New offer'}</h3>
    {FIELDS.map(([k, l, long]) => <label key={k}>{l}{long ? <textarea value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <input value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</label>)}
    <label>Status<select value={v.status || 'Open'} onChange={(e) => setV({ ...v, status: e.target.value })}><option>Open</option><option>Closed</option></select></label>
    <div className="row"><button className="btn pri" onClick={() => onSave(v)}>Save</button><button className="btn" onClick={onCancel}>Cancel</button></div></section>)
}

function Login() {
  const [e, setE] = useState(''), [p, setP] = useState(''), [m, setM] = useState('')
  const go = async () => { const { error } = await api.auth.login(e, p); if (error) setM(error.message) }
  return (<section className="card login"><h3>Admin login</h3>
    <label>Email<input value={e} onChange={(x) => setE(x.target.value)} /></label>
    <label>Password<input type="password" value={p} onChange={(x) => setP(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && go()} /></label>
    <button className="btn pri" onClick={go}>Sign in</button>{m && <p className="err">{m}</p>}</section>)
}
