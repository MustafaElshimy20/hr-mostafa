import { useEffect, useMemo, useRef, useState } from 'react'
import { FIELDS, SECTIONS, HINTS, SETTINGS } from './fields'
import * as api from './api'
import { companyKey, low, detectSalaryType, salaryTypeOf, SALARY_TYPES } from './lib'
import { filterById } from './taxonomy'
import { FiltersTab, TagEditor, Classify } from './FilterAdmin'
import ShareEditor from './ShareEditor'
import { smartFill } from './smartParse'

const field = (k) => FIELDS.find((x) => x[0] === k)
const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
const stamp = () => new Date().toISOString().slice(0, 10)

export default function Admin({ offers, settings, tax, session, reload }) {
  const [tab, setTab] = useState('offers'), [edit, setEdit] = useState(null), [msg, setMsg] = useState(null), timer = useRef()
  const say = (text, bad) => { setMsg({ text, bad }); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 3200) }
  const run = async (fn, ok) => { try { await fn(); await reload(); say(ok) } catch (e) { say('Error: ' + (e.message || e), true) } }
  if (!api.demo && !session) return <Login />
  const open = offers.filter((o) => o.status !== 'Closed').length
  const stats = [['Total offers', offers.length], ['Open', open], ['Closed', offers.length - open], ['Companies', new Set(offers.map((o) => companyKey(o.company))).size]]
  return (<div className="admin">
    <div className="ahead">
      <div><h2>Admin</h2><span className="muted">{api.demo ? 'Demo mode' : session.user.email}</span></div>
      <div className="row"><a className="btn" href="#">← View site</a>{!api.demo && <button className="btn" onClick={api.auth.logout}>Sign out</button>}</div></div>
    {api.demo && <p className="note">Demo mode: changes are saved only in this browser. Add your Supabase keys to save online (see README).</p>}
    <div className="stats">{stats.map(([l, n]) => <div key={l} className="stat"><b>{n}</b><span>{l}</span></div>)}</div>
    <div className="atabs">
      <button className={tab === 'offers' ? 'on' : ''} onClick={() => setTab('offers')}>Offers</button>
      <button className={tab === 'filters' ? 'on' : ''} onClick={() => setTab('filters')}>Filters</button>
      <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>Site settings & backup</button></div>
    {tab === 'offers' ? <OffersTab {...{ offers, tax, run, setEdit }} /> : tab === 'filters' ? <FiltersTab {...{ offers, tax, run, say }} /> : <SettingsTab {...{ offers, settings, tax, run, say }} />}
    {edit && <OfferForm o={edit} offers={offers} tax={tax} shareTpl={settings.share_template} run={run} onClose={() => setEdit(null)} />}
    {msg && <div className={'toast' + (msg.bad ? ' bad' : '')} role="status">{msg.text}</div>}
  </div>)
}

function OffersTab({ offers, tax, run, setEdit }) {
  const [q, setQ] = useState(''), [st, setSt] = useState(''), [sel, setSel] = useState([]), [cls, setCls] = useState(false)
  const list = useMemo(() => offers.filter((o) => (!st || (o.status === 'Closed' ? 'Closed' : 'Open') === st) && (!q || low([...Object.entries(o).filter(([k]) => k !== 'tags').map(([, v]) => v), ].join(' ')).includes(low(q)))), [offers, q, st])
  const groups = useMemo(() => { const g = []; list.forEach((o) => { const k = companyKey(o.company), last = g[g.length - 1]; last && last.k === k ? last.items.push(o) : g.push({ k, name: o.company, items: [o] }) }); return g }, [list])
  const chosen = offers.filter((o) => sel.includes(o.id)), allOn = list.length > 0 && list.every((o) => sel.includes(o.id))
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const flip = (o) => run(() => api.saveOffer({ ...o, status: o.status === 'Closed' ? 'Open' : 'Closed' }), o.status === 'Closed' ? 'Offer reopened ✔' : 'Offer closed ✔')
  const dup = (o) => { const { id, ...rest } = o; setEdit({ ...rest, status: 'Open' }) }
  const del = (o) => confirm(`Delete "${o.position}" at ${o.company}?`) && run(() => api.deleteOffer(o.id), 'Offer deleted ✔')
  const bulk = (fn, ok) => run(async () => { await fn(); setSel([]) }, ok)
  return (<>
    <div className="tools">
      <input placeholder="🔍 Search offers…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option><option>Open</option><option>Closed</option></select>
      <button className="btn pri" onClick={() => setEdit({ status: 'Open', work_mode: 'On-site' })}>+ New offer</button></div>
    <div className="selbar">
      <label className="chk"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : list.map((o) => o.id))} /> {chosen.length ? `${chosen.length} selected` : `Select all (${list.length})`}</label>
      {chosen.length > 0 && <div className="row">
        <button className="btn sm pri" onClick={() => setCls(true)}>Classify…</button>
        <button className="btn sm" onClick={() => bulk(() => api.saveMany(chosen.map((o) => ({ ...o, status: 'Open' }))), 'Reopened ✔')}>Reopen</button>
        <button className="btn sm" onClick={() => bulk(() => api.saveMany(chosen.map((o) => ({ ...o, status: 'Closed' }))), 'Closed ✔')}>Close</button>
        <select className="btn sm" aria-label="Set salary type" value="" onChange={(e) => { const t = e.target.value; if (t) bulk(() => api.saveMany(chosen.map((o) => ({ ...o, salary_type: t }))), `Salary type set to ${t} ✔`) }}>
          <option value="">Salary type…</option>{SALARY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <button className="btn sm" title="Moves the Notes text into Internal notes so visitors no longer see it"
          onClick={() => confirm('Move the visible Notes of the selected offers into Internal notes (hidden from visitors)?') && bulk(() => api.saveMany(chosen.filter((o) => o.notes).map((o) => ({ ...o, internal: [o.internal, o.notes].filter(Boolean).join('\n'), notes: '' }))), 'Notes hidden from visitors ✔')}>Hide notes</button>
        <button className="btn sm del" onClick={() => confirm(`Delete ${chosen.length} offer(s)? This cannot be undone.`) && bulk(() => api.deleteMany(chosen.map((o) => o.id)), 'Deleted ✔')}>Delete</button></div>}
    </div>
    {groups.map((g) => <section className="agroup" key={g.k + g.items[0].id}>
      <div className="gh"><b>{g.name}</b><span>{g.items.length}</span></div>
      {g.items.map((o) => <div className={'arow' + (o.status === 'Closed' ? ' closed' : '')} key={o.id}>
        <input type="checkbox" aria-label="Select" checked={sel.includes(o.id)} onChange={() => toggle(o.id)} />
        <button className="ainfo" onClick={() => setEdit(o)}><b>{o.position}{salaryTypeOf(o) && <>{' '}<span className={'stype ' + salaryTypeOf(o).toLowerCase()}>{salaryTypeOf(o)}</span></>}</b><small>{[o.location, o.salary].filter(Boolean).join(' · ').slice(0, 90)}</small></button>
        <button className={'pill ' + (o.status === 'Closed' ? 'off' : 'on')} onClick={() => flip(o)} title="Click to switch">{o.status === 'Closed' ? 'Closed' : 'Open'}</button>
        <div className="row acts2"><button className="btn sm" onClick={() => setEdit(o)}>Edit</button><button className="btn sm" onClick={() => dup(o)} title="Create a copy (same company)">Duplicate</button><button className="btn sm del" onClick={() => del(o)}>Delete</button></div>
      </div>)}
    </section>)}
    {cls && <Classify chosen={chosen} tax={tax} run={(fn, ok) => run(fn, ok).then(() => setSel([]))} onClose={() => setCls(false)} />}
    {!list.length && <p className="empty">{offers.length ? 'No offers match your search.' : 'No offers yet. Click “+ New offer”.'}{!api.demo && !offers.length && <> <button className="btn sm" onClick={() => run(api.importStarter, 'Starter offers loaded ✔')}>Load starter offers</button></>}</p>}
  </>)
}

function OfferForm({ o, offers, tax, shareTpl, run, onClose }) {
  const [tx, setTx] = useState(tax)
  const [v, setV] = useState(() => ({ ...o, salary_type: o.salary_type || detectSalaryType(o) || 'Not specified' })), [err, setErr] = useState('')
  const [paste, setPaste] = useState(''), [smartOpen, setSmartOpen] = useState(!o.id && !o.company), [auto, setAuto] = useState([]), [sinfo, setSinfo] = useState(null), [busy, setBusy] = useState(false)
  const [typeChosen, setTypeChosen] = useState(!!o.salary_type) // once the admin picks Net/Gross, typing in the salary box no longer changes it
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, [])
  const fill = async () => {
    if (paste.trim().length < 10) return setSinfo({ bad: true, text: 'Paste the offer text first.' })
    setBusy(true); setSinfo(null)
    const r = await smartFill(paste, { tax: tx, companies: [...new Set(offers.map((x) => x.company).filter(Boolean))] }, api.parseOfferAI)
    setBusy(false)
    const keys = r.found
    if (!keys.length) return setSinfo({ bad: true, text: 'Could not find any details in this text.' })
    setV((p) => { const n = { ...p }; keys.forEach((k) => { n[k] = k === 'internal' && p.internal ? p.internal + '\n' + r.fields[k] : r.fields[k] }); return n })
    if (r.fields.salary_type) setTypeChosen(true)
    setAuto(keys)
    setSinfo({ text: `Filled ${keys.length} field${keys.length > 1 ? 's' : ''}${r.ai ? ' with AI' : ''}. Please review the highlighted fields, then save.`, miss: ['company', 'position'].filter((k) => !r.fields[k]) })
  }
  const set = (k) => (e) => { const val = e.target.value; setAuto((a) => a.filter((x) => x !== k))
    if (k === 'salary_type') setTypeChosen(true)
    setV((p) => { const n = { ...p, [k]: val }; if (k === 'salary' && !typeChosen) { const d = detectSalaryType(n); if (d) n.salary_type = d } return n }) }
  const save = () => {
    const c = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x]))
    if (!c.share_text) delete c.share_text
    if (!c.company || !c.position) return setErr('Company and Position are required.')
    if (c.link && !/^https?:\/\//i.test(c.link)) return setErr('Form link must start with http:// or https://')
    const same = offers.find((x) => x.id !== c.id && companyKey(x.company) === companyKey(c.company) && low(x.position) === low(c.position) && low(x.location) === low(c.location))
    if (same && !confirm('An offer with the same company, position and location already exists. Save anyway?')) return
    const t = tx // a new filter value typed in the form is already part of the draft `tx`
    run(async () => { if (JSON.stringify(t) !== JSON.stringify(tax)) await api.saveTaxonomy(t); await api.saveOffer(c); onClose() }, 'Offer saved ✔')
  }
  return (<div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="panel" role="dialog" aria-modal="true">
      <div className="ph"><h3>{o.id ? 'Edit offer' : 'New offer'}</h3><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
      <div className="pb">
        <div className={'smart' + (smartOpen ? ' open' : '')}>
          <button type="button" className="smarthead" onClick={() => setSmartOpen(!smartOpen)} aria-expanded={smartOpen}><span>✨ Smart fill</span><small>Paste the offer text and the form fills itself</small><i>{smartOpen ? '−' : '+'}</i></button>
          {smartOpen && <div className="smartbody">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} dir="auto" placeholder={'Paste the job post here (English or Arabic), for example:\nTeleperformance is hiring French Customer Service\nLocation: Nasr City\nSalary: 15,000 net\nLanguage: French C1 + English B2\nApply: https://…'} />
            <div className="row"><button type="button" className="btn pri" onClick={fill} disabled={busy}>{busy ? 'Reading…' : '✨ Fill the form'}</button>{paste && <button type="button" className="btn" onClick={() => { setPaste(''); setSinfo(null) }}>Clear</button>}
              <span className="muted small">Nothing is saved until you press “Save offer”. Anything it could not place goes to Internal notes (hidden from visitors).</span></div>
            {sinfo && <p className={sinfo.bad ? 'err' : 'smartok'}>{sinfo.text}{sinfo.miss && sinfo.miss.length > 0 && <> Still missing: <b>{sinfo.miss.join(', ')}</b>.</>}</p>}
          </div>}
        </div>
        {SECTIONS.map(([title, keys]) => <fieldset key={title}><legend>{title}</legend>
          <div className="fgrid">{keys.map((k) => { const [, label, long, fopts] = field(k), opts = k === 'work_mode' ? ((filterById(tx, 'work') || { options: [] }).options.map((x) => x.v).concat(v.work_mode && !(filterById(tx, 'work').options.some((x) => x.v === v.work_mode)) ? [v.work_mode] : [])) : fopts
            return <label key={k} className={(long ? 'full' : '') + (auto.includes(k) ? ' auto' : '')}>{label}
              {opts ? <select value={v[k] || opts[0]} onChange={set(k)}>{opts.map((x) => <option key={x}>{x}</option>)}</select>
                : long ? <textarea value={v[k] || ''} onChange={set(k)} placeholder={HINTS[k] || ''} /> : <input value={v[k] || ''} onChange={set(k)} placeholder={HINTS[k] || ''} />}</label> })}</div></fieldset>)}
        <TagEditor v={v} setV={setV} tx={tx} setTx={setTx} />
        <fieldset><legend>WhatsApp share message (optional)</legend>
          <p className="muted small">Leave empty to use the site’s standard share message. Write something here to use a special message only for this offer.</p>
          <ShareEditor value={v.share_text} onChange={(x) => setV((p) => ({ ...p, share_text: x }))} sample={v} tax={tx} template={shareTpl} placeholder="Empty = standard message" /></fieldset>
      </div>
      <div className="pf">{err && <span className="err">{err}</span>}<span className="grow" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" onClick={save}>Save offer</button></div>
    </div></div>)
}

function SettingsTab({ offers, settings, tax, run, say }) {
  const [s, setS] = useState(settings), [pw, setPw] = useState(''), file = useRef()
  useEffect(() => setS(settings), [settings])
  const exportJson = () => download(`offers-backup-${stamp()}.json`, JSON.stringify(offers.map(({ id, ...d }) => d), null, 1), 'application/json')
  const exportCsv = () => { const keys = FIELDS.map((f) => f[0]); download(`offers-${stamp()}.csv`, '﻿' + [FIELDS.map((f) => csvCell(f[1])).join(','), ...offers.map((o) => keys.map((k) => csvCell(o[k])).join(','))].join('\n'), 'text/csv') }
  const importJson = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    try { const d = JSON.parse(await f.text()); if (!Array.isArray(d) || !d.every((x) => x && x.company && x.position)) throw new Error('bad file')
      if (confirm(`Import ${d.length} offer(s)? They will be ADDED to your current offers (nothing is replaced).`)) run(() => api.importMany(d), `${d.length} offers imported ✔`)
    } catch { say('That file is not a valid offers backup.', true) } }
  const changePw = async () => { if (pw.length < 8) return say('Password must be at least 8 characters.', true)
    const { error } = await api.auth.changePassword(pw); error ? say('Error: ' + error.message, true) : (setPw(''), say('Password changed ✔')) }
  return (<div className="sgrid">
    <section className="acard"><h3>Site text</h3>
      {SETTINGS.map(([k, l, long]) => <label key={k}>{l}{long ? <textarea value={s[k] || ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} /> : <input value={s[k] || ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} />}</label>)}
      <p className="muted small">Tip: use the banner for news like “New offers added today ✨”. Leave it empty to hide it.</p>
      <button className="btn pri" onClick={() => run(() => api.saveSettings(s), 'Settings saved ✔')}>Save settings</button></section>
    <section className="acard"><h3>WhatsApp share message</h3>
      <p className="muted small">The text visitors send when they tap “Share on WhatsApp” on an offer. Write it your way, add emojis, and click a button to insert details that change per offer (job title, salary…). A line whose detail is missing for an offer is left out automatically. You can also write a special message for one offer inside that offer’s edit form. Leave this empty to use the standard message.</p>
      <ShareEditor value={s.share_template} onChange={(v) => setS({ ...s, share_template: v })} sample={{ ...(offers.find((o) => o.status !== 'Closed') || offers[0] || { position: 'Job title', company: 'Company' }), share_text: '' }} tax={tax} template={s.share_template} />
      <div className="row"><button className="btn pri" onClick={() => run(() => api.saveSettings(s), 'Share message saved ✔')}>Save share message</button><button className="btn" onClick={() => setS({ ...s, share_template: '' })}>Back to the standard message</button></div></section>
    <section className="acard"><h3>Backup</h3>
      <p className="muted small">Download your offers regularly. The JSON file can be imported back; the CSV opens in Excel / Google Sheets.</p>
      <div className="row"><button className="btn" onClick={exportJson}>⬇ Backup (JSON)</button><button className="btn" onClick={exportCsv}>⬇ Excel (CSV)</button>
        <button className="btn" onClick={() => file.current.click()}>⬆ Import backup</button><input ref={file} type="file" accept=".json" hidden onChange={importJson} /></div></section>
    {!api.demo && <section className="acard"><h3>Security</h3>
      <p className="muted small">Only signed-in users can change offers. Keep “Allow new users to sign up” turned OFF in Supabase so nobody else can create an account.</p>
      <label>New password<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" /></label>
      <button className="btn" onClick={changePw}>Change password</button></section>}
  </div>)
}

function Login() {
  const [e, setE] = useState(''), [p, setP] = useState(''), [m, setM] = useState(''), [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); setM(''); const { error } = await api.auth.login(e.trim(), p); setBusy(false); if (error) setM(error.message) }
  return (<section className="loginbox"><h3>Admin sign in</h3><p className="muted small">This area is only for the site owner.</p>
    <label>Email<input type="email" autoComplete="username" value={e} onChange={(x) => setE(x.target.value)} /></label>
    <label>Password<input type="password" autoComplete="current-password" value={p} onChange={(x) => setP(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && go()} /></label>
    <button className="btn pri wide" disabled={busy} onClick={go}>{busy ? 'Signing in…' : 'Sign in'}</button>{m && <p className="err">{m}</p>}
    <a className="back" href="#">← Back to the site</a></section>)
}
