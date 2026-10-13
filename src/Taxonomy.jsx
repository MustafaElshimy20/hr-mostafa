import { useEffect, useMemo, useState } from 'react'
import { FIELDS } from './fields'
import * as api from './api'
import { norm, optLabel, valuesOf, categoriesOf, isAutoCategory, allCategories, withCats, withTags, dropTags, hasDetector, defaultTax, levelNeeds, LV } from './taxonomy'

// text box that saves when you leave it / press Enter. onCommit may return false to reject (the box then goes back).
function Inline({ value, onCommit, placeholder, className, type }) {
  const [v, setV] = useState(String(value ?? ''))
  useEffect(() => setV(String(value ?? '')), [value])
  const commit = () => { const t = v.trim(); if (t === String(value ?? '')) return setV(String(value ?? '')); if (onCommit(t) === false) setV(String(value ?? '')) }
  return <input className={className} type={type} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
}
const dupe = (list, name, except) => list.some((x) => norm(x) === norm(name) && x !== except)
const FIELD_CHOICES = FIELDS.filter(([k]) => !['status', 'internal', 'link', 'salary_type', 'notes'].includes(k))

// ================= CATEGORIES =================
export function CategoriesTab({ offers, tax, run, say }) {
  const [name, setName] = useState(''), [del, setDel] = useState(null), [target, setTarget] = useState('')
  const counts = useMemo(() => { const m = {}; offers.forEach((o) => categoriesOf(o, tax).forEach((c) => { m[c] = (m[c] || 0) + 1 })); return m }, [offers, tax])
  const auto = offers.filter(isAutoCategory).length
  const list = allCategories(offers, tax)
  const saveCats = (categories, ok, offerChanges = []) => run(async () => { if (offerChanges.length) await api.saveMany(offerChanges); await api.saveTaxonomy({ ...tax, categories }) }, ok)
  const add = () => { const n = name.trim(); if (!n) return; if (n.length > 40) return say('Keep the name under 40 characters.', true)
    if (dupe(list, n)) return say('That category already exists.', true)
    const i = tax.categories.findIndex((c) => norm(c) === 'other'), cats = [...tax.categories]; cats.splice(i < 0 ? cats.length : i, 0, n)
    setName(''); saveCats(cats, `Category “${n}” added ✔`) }
  const rename = (old, nv) => { if (!nv) return false; if (nv.length > 40) { say('Keep the name under 40 characters.', true); return false }
    const clash = list.find((c) => c !== old && norm(c) === norm(nv))
    if (clash && !confirm(`“${clash}” already exists. Merge “${old}” into it? (${counts[old] || 0} offers will move.)`)) return false
    const moved = offers.filter((o) => categoriesOf(o, tax).includes(old)).map((o) => withCats(o, categoriesOf(o, tax).map((c) => (c === old ? clash || nv : c))))
    const cats = tax.categories.map((c) => (c === old ? (clash || nv) : c)).filter((c, i, a) => a.findIndex((x) => norm(x) === norm(c)) === i)
    if (!cats.some((c) => norm(c) === norm(clash || nv))) cats.push(clash || nv)
    saveCats(cats, 'Category renamed ✔', moved) }
  const move = (c, d) => { const a = [...tax.categories], i = a.indexOf(c), j = i + d; if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; saveCats(a, 'Order saved ✔') }
  const remove = (c) => { const n = counts[c] || 0
    if (n) { setDel(c); setTarget(''); return }
    if (confirm(`Delete the category “${c}”?`)) saveCats(tax.categories.filter((x) => x !== c), 'Category deleted ✔') }
  const reassignDelete = () => { if (!target) return say('Choose where the offers should go first.', true)
    const moved = offers.filter((o) => categoriesOf(o, tax).includes(del)).map((o) => withCats(o, categoriesOf(o, tax).map((c) => (c === del ? target : c))))
    saveCats(tax.categories.filter((x) => x !== del), `${moved.length} offers moved to “${target}”, category deleted ✔`, moved); setDel(null) }
  const pin = () => confirm(`Save the automatic category into the ${auto} offer(s) that don't have one chosen? (Nothing changes on the site; it just stops guessing.)`) &&
    run(() => api.saveMany(offers.filter(isAutoCategory).map((o) => withCats(o, categoriesOf(o, tax)))), 'Categories saved into the offers ✔')
  return (<div className="sgrid">
    <section className="acard"><h3>Categories</h3>
      <p className="muted small">These are the chips at the top of the website. A category appears there as soon as at least one open offer is in it. An offer can be in several categories. Choose them in the offer’s edit form, or select offers in the Offers tab and use “Classify”.</p>
      <div className="addrow"><input placeholder="New category, e.g. Graphic Designer" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button className="btn pri" onClick={add}>+ Add category</button></div>
      <div className="tlist">{list.map((c) => { const locked = norm(c) === 'other', listed = tax.categories.includes(c)
        return <div className="trow" key={c}>
          <span className="ord"><button className="mini" disabled={!listed || tax.categories[0] === c} onClick={() => move(c, -1)} aria-label="Move up">▲</button><button className="mini" disabled={!listed || tax.categories[tax.categories.length - 1] === c} onClick={() => move(c, 1)} aria-label="Move down">▼</button></span>
          {locked ? <b className="grow">{c} <small className="muted">(catch-all, can’t be changed)</small></b> : <Inline className="grow plain" value={c} onCommit={(v) => rename(c, v)} />}
          <span className="count">{counts[c] || 0} offers</span>
          {!locked && <button className="btn sm del" onClick={() => remove(c)}>Delete</button>}
        </div> })}</div>
      {auto > 0 && <p className="muted small">{auto} offer(s) have no category chosen, so the site guesses it from the job title. <button className="link" onClick={pin}>Save the guesses into the offers</button> to lock them in.</p>}
    </section>
    {del && <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setDel(null)}><div className="panel small-panel" role="dialog" aria-modal="true">
      <div className="ph"><h3>Delete “{del}”</h3><button className="x" onClick={() => setDel(null)} aria-label="Close">✕</button></div>
      <div className="pb"><p><b>{counts[del]}</b> offer(s) are in this category. A category that is still in use can’t be deleted — move those offers first.</p>
        <label>Move them to<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose a category…</option>{list.filter((c) => c !== del).map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <div className="pf"><span className="grow" /><button className="btn" onClick={() => setDel(null)}>Cancel</button><button className="btn pri" onClick={reassignDelete}>Move offers & delete</button></div></div></div>}
  </div>)
}

// ================= FILTERS =================
export function FiltersTab({ offers, tax, run, say }) {
  const [open, setOpen] = useState(null), [nf, setNf] = useState(''), [no, setNo] = useState({})
  const saveTax = (t, ok, changed = []) => run(async () => { if (changed.length) await api.saveMany(changed); await api.saveTaxonomy(t) }, ok)
  const patch = (id, p, ok = 'Saved ✔') => saveTax({ ...tax, filters: tax.filters.map((f) => (f.id === id ? { ...f, ...p } : f)) }, ok)
  const move = (i, d) => { const a = [...tax.filters], j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; saveTax({ ...tax, filters: a }, 'Order saved ✔') }
  const addFilter = () => { const l = nf.trim(); if (!l) return; if (tax.filters.some((f) => norm(f.label) === norm(l))) return say('A filter with that name already exists.', true)
    const f = { id: 'f' + Date.now().toString(36), label: l, visible: true, builtin: false, kind: 'options', field: '', pick: 'all', options: [] }
    setNf(''); setOpen(f.id); saveTax({ ...tax, filters: [...tax.filters, f] }, `Filter “${l}” added — now add its values ✔`) }
  const delFilter = (f) => { const n = offers.filter((o) => o.tags && o.tags[f.id]).length
    if (confirm(`Delete the filter “${f.label}”${n ? ` and its values on ${n} offer(s)` : ''}? It will disappear from the website.`))
      saveTax({ ...tax, filters: tax.filters.filter((x) => x.id !== f.id) }, 'Filter deleted ✔', offers.filter((o) => o.tags && o.tags[f.id]).map((o) => dropTags(o, f.id))) }
  const restore = (f) => { const d = defaultTax().filters.find((x) => x.id === f.id); if (d && confirm(`Restore “${f.label}” to its original values? Your edits to this filter will be lost (offers you tagged by hand keep their tags where the value still exists).`)) patch(f.id, d, 'Restored ✔') }
  const setOpts = (f, options, ok, changed) => saveTax({ ...tax, filters: tax.filters.map((x) => (x.id === f.id ? { ...x, options } : x)) }, ok, changed)
  const addOpt = (f) => { const v = (no[f.id] || '').trim(); if (!v) return
    if (dupe(f.options.map((x) => x.v), v)) return say('That value already exists in this filter.', true)
    setNo({ ...no, [f.id]: '' }); setOpts(f, [...f.options, { v, kw: [] }], `“${v}” added ✔`) }
  const upd = (f, x, p, ok) => setOpts(f, f.options.map((y) => (y === x ? { ...y, ...p } : y)), ok)
  const rename = (f, x, nv) => { if (!nv) return false; if (dupe(f.options.map((y) => y.v), nv, x.v)) { say('That value already exists in this filter.', true); return false }
    const changed = offers.filter((o) => Array.isArray(o.tags && o.tags[f.id]) && o.tags[f.id].includes(x.v)).map((o) => withTags(o, f.id, o.tags[f.id].map((v) => (v === x.v ? nv : v))))
    const options = f.options.map((y) => (y === x ? { ...y, v: nv, kw: f.field ? [...new Set([...(y.kw || []), x.v])] : y.kw } : y)) // old name stays a keyword so offers that still say it keep matching
    const filters = tax.filters.map((g) => (g.id === f.id ? { ...g, options } : g.dependsOn === f.id ? { ...g, options: g.options.map((y) => (y.parent === x.v ? { ...y, parent: nv } : y)) } : g))
    saveTax({ ...tax, filters }, 'Renamed ✔', changed) }
  const delOpt = (f, x) => { const kids = tax.filters.filter((g) => g.dependsOn === f.id).flatMap((g) => g.options.filter((y) => y.parent === x.v))
    if (kids.length) return say(`“${x.v}” still has ${kids.length} value(s) under it (${kids.slice(0, 3).map((y) => y.v).join(', ')}…). Move or delete those first.`, true)
    const used = offers.filter((o) => valuesOf(o, f, tax).includes(x.v)).length
    if (!confirm(`Delete “${x.v}” from “${f.label}”?${used ? ` ${used} offer(s) currently have it; they will no longer be in it.` : ''}`)) return
    const changed = offers.filter((o) => Array.isArray(o.tags && o.tags[f.id]) && o.tags[f.id].includes(x.v)).map((o) => withTags(o, f.id, o.tags[f.id].filter((v) => v !== x.v)))
    setOpts(f, f.options.filter((y) => y !== x), 'Value deleted ✔', changed) }
  const parentF = (f) => tax.filters.find((g) => g.id === f.dependsOn)
  return (<div className="sgrid">
    <section className="acard"><h3>Filters</h3>
      <p className="muted small">These are the dropdowns on the website. Hide one with the checkbox, add your own, and edit the values inside each. To put an offer in a value, open the offer (or select several and use “Classify”). A value with no choice made by you is detected from the offer’s text.</p>
      <div className="addrow"><input placeholder="New filter, e.g. Experience" value={nf} onChange={(e) => setNf(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFilter()} /><button className="btn pri" onClick={addFilter}>+ Add filter</button></div>
    </section>
    {tax.filters.map((f, i) => { const isOpen = open === f.id, level = f.kind === 'level', pf = parentF(f)
      return <section className="acard fcard" key={f.id}>
        <div className="trow nob">
          <span className="ord"><button className="mini" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">▲</button><button className="mini" disabled={i === tax.filters.length - 1} onClick={() => move(i, 1)} aria-label="Move down">▼</button></span>
          <Inline className="grow plain" value={f.label} onCommit={(v) => (v ? patch(f.id, { label: v }) : false)} />
          <label className="chk vis"><input type="checkbox" checked={f.visible} onChange={(e) => patch(f.id, { visible: e.target.checked }, e.target.checked ? 'Filter is now visible on the website ✔' : 'Filter hidden from the website ✔')} /> Show on website</label>
          <button className="btn sm" onClick={() => setOpen(isOpen ? null : f.id)}>{isOpen ? 'Close' : `Values (${f.options.length})`}</button>
        </div>
        {f.visible && !f.options.length && <p className="warnline">This filter has no values yet, so visitors don’t see it. Add at least one value.</p>}
        {isOpen && <div className="fbody">
          {level ? <p className="muted small">Language levels follow the standard A2–C2 scale, so the values can’t be edited. You can rename or hide the filter, and assign a level to any offer in its edit form.</p> : <>
            <div className="fset">
              <label>Detect from<select value={f.field || ''} onChange={(e) => patch(f.id, { field: e.target.value })} disabled={!!f.detector}>
                <option value="">Nothing — I assign offers myself</option>{FIELD_CHOICES.map(([k, l]) => <option key={k} value={k}>{l.replace(/ \(.*/, '')}</option>)}</select></label>
              <label>Values per offer<select value={f.pick === 'first' ? 'first' : 'all'} onChange={(e) => patch(f.id, { pick: e.target.value })}><option value="all">Can have several</option><option value="first">One (the first found)</option></select></label>
              <label>Offers with no value<select value={f.unrestricted ? 'all' : 'none'} onChange={(e) => patch(f.id, { unrestricted: e.target.value === 'all' })}><option value="none">Don’t show when a value is chosen</option><option value="all">Show for every choice</option></select></label>
              <label>Depends on<select value={f.dependsOn || ''} onChange={(e) => patch(f.id, { dependsOn: e.target.value })}><option value="">Nothing</option>{tax.filters.filter((g) => g.id !== f.id && g.kind !== 'level' && g.dependsOn !== f.id).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label></div>
            {f.field && <p className="muted small">Keywords are matched as whole words in the offer’s “{(FIELDS.find((x) => x[0] === f.field) || [0, f.field])[1].replace(/ \(.*/, '')}” text. End a keyword with * to match word beginnings (grad* finds graduate, grads).</p>}
            <div className="otable">
              <div className="orow ohead"><span>Value</span>{f.field && f.field !== 'salary' && !f.detector && <span>Also detected by (comma separated)</span>}{f.field === 'salary' && <span>From – to (EGP)</span>}{pf && <span>Under</span>}<span>Offers</span><span /></div>
              {f.options.map((x) => <div className="orow" key={x.v}>
                <Inline value={x.v} onCommit={(v) => rename(f, x, v)} />
                {f.field && f.field !== 'salary' && !f.detector && <Inline value={(x.kw || []).join(', ')} placeholder="e.g. cairo, giza" onCommit={(v) => upd(f, x, { kw: v.split(',').map((k) => k.trim()).filter(Boolean) }, 'Keywords saved ✔')} />}
                {f.field === 'salary' && <span className="pair"><Inline type="number" value={x.min ?? ''} placeholder="from" onCommit={(v) => upd(f, x, { min: v === '' ? undefined : +v }, 'Saved ✔')} /><Inline type="number" value={x.max ?? ''} placeholder="to" onCommit={(v) => upd(f, x, { max: v === '' ? undefined : +v }, 'Saved ✔')} /></span>}
                {pf && <select value={x.parent || ''} onChange={(e) => upd(f, x, { parent: e.target.value }, 'Saved ✔')}><option value="">— none —</option>{pf.options.map((p) => <option key={p.v}>{p.v}</option>)}</select>}
                <span className="count">{offers.filter((o) => valuesOf(o, f, tax).includes(x.v)).length}</span>
                <button className="btn sm del" onClick={() => delOpt(f, x)}>Delete</button></div>)}
              <div className="addrow"><input placeholder="Add a value…" value={no[f.id] || ''} onChange={(e) => setNo({ ...no, [f.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addOpt(f)} /><button className="btn" onClick={() => addOpt(f)}>+ Add value</button></div></div></>}
          <div className="row">{f.builtin ? <button className="btn sm" onClick={() => restore(f)}>Restore original values</button> : <button className="btn sm del" onClick={() => delFilter(f)}>Delete this filter</button>}</div>
        </div>}
      </section> })}
  </div>)
}

// ================= in the offer form: category + filter values =================
export function TagEditor({ v, setV, tx, setTx }) {
  const [adding, setAdding] = useState({}), [newCat, setNewCat] = useState('')
  const cats = categoriesOf(v, tx)
  const setCats = (list) => setV((p) => withCats(p, list))
  const toggleCat = (c) => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...(isAutoCategory(v) ? [] : cats), c])
  const addCat = () => { const t = newCat.trim(); if (!t) return; if (t.length > 40) return
    const have = tx.categories.find((x) => norm(x) === norm(t)), name = have || t
    if (!have) setTx((p) => { const i = p.categories.findIndex((x) => norm(x) === 'other'), l = [...p.categories]; l.splice(i < 0 ? l.length : i, 0, name); return { ...p, categories: l } })
    setCats([...new Set([...(isAutoCategory(v) ? [] : cats), name])]); setNewCat('') }
  const setTags = (id, vals) => setV((p) => (vals === null ? dropTags(p, id) : withTags(p, id, vals)))
  const curOf = (fl) => { if (fl.kind !== 'level' || Array.isArray(v.tags && v.tags[fl.id])) return valuesOf(v, fl, tx); const r = Math.max(-1, ...Object.values(levelNeeds(v, tx)).map((x) => LV.indexOf(x))); return r >= 0 && fl.options.some((x) => x.v === LV[r]) ? [LV[r]] : [] }
  const toggle = (fl, val) => { const cur = curOf(fl), single = fl.kind === 'level' || fl.pick === 'first'
    setTags(fl.id, cur.includes(val) ? cur.filter((x) => x !== val) : single ? [val] : [...cur, val]) }
  const addValue = (fl) => { const t = (adding[fl.id] || '').trim(); if (!t) return
    const have = fl.options.find((x) => norm(x.v) === norm(t)), val = have ? have.v : t
    if (!have) setTx((p) => ({ ...p, filters: p.filters.map((x) => (x.id === fl.id ? { ...x, options: [...x.options, { v: val, kw: [] }] } : x)) }))
    const cur = valuesOf(v, fl, tx)
    setTags(fl.id, fl.pick === 'first' ? [val] : [...new Set([...cur, val])]); setAdding({ ...adding, [fl.id]: '' }) }
  return (<fieldset><legend>Category & filters</legend>
    <div className="tagrow"><div className="tagh"><b>Categories</b><small className="muted">{isAutoCategory(v) ? 'automatic (guessed from the job title)' : 'set by you — pick as many as fit'}</small>
      {!isAutoCategory(v) && <button className="link small" onClick={() => setV((p) => { const n = { ...p }; delete n.categories; delete n.category; return n })}>Back to automatic</button>}</div>
      <div className="tagchips">{tx.categories.filter((c) => norm(c) !== 'other' || cats.includes(c)).map((c) => <button type="button" key={c} className={'tchip' + (cats.includes(c) ? ' on' : '')} onClick={() => toggleCat(c)}>{c}</button>)}
        <span className="tadd"><input aria-label="New category" placeholder="+ new category" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCat() } }} />{newCat.trim() && <button type="button" className="btn sm" onClick={addCat}>Add</button>}</span></div></div>
    {tx.filters.map((fl) => { const explicit = Array.isArray(v.tags && v.tags[fl.id]), cur = curOf(fl)
      const gov = fl.dependsOn && valuesOf(v, tx.filters.find((g) => g.id === fl.dependsOn) || { options: [], id: '-' }, tx)
      const opts = fl.options.filter((x) => !fl.dependsOn || !x.parent || !gov || !gov.length || gov.includes(x.parent) || cur.includes(x.v))
      return <div className="tagrow" key={fl.id}>
        <div className="tagh"><b>{fl.label}</b>{!fl.visible && <small className="hid">hidden on site</small>}
          <small className="muted">{explicit ? 'set by you' : (hasDetector(fl) || fl.kind === 'level') ? 'automatic' : 'not set'}</small>
          {explicit && <button className="link small" onClick={() => setTags(fl.id, null)}>{(hasDetector(fl) || fl.kind === 'level') ? 'Back to automatic' : 'Clear'}</button>}</div>
        <div className="tagchips">{opts.map((x) => <button type="button" key={x.v} className={'tchip' + (cur.includes(x.v) ? ' on' : '')} onClick={() => toggle(fl, x.v)}>{optLabel(x)}</button>)}
          {!opts.length && <span className="muted small">No values yet.</span>}
          {fl.kind !== 'level' && <span className="tadd"><input placeholder="+ new value" value={adding[fl.id] || ''} onChange={(e) => setAdding({ ...adding, [fl.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addValue(fl) } }} />{(adding[fl.id] || '').trim() && <button type="button" className="btn sm" onClick={() => addValue(fl)}>Add</button>}</span>}</div>
      </div> })}
  </fieldset>)
}

// ================= bulk classify (selected offers) =================
export function Classify({ chosen, tax, run, onClose }) {
  const [cat, setCat] = useState(''), [fid, setFid] = useState(''), [val, setVal] = useState('')
  const fl = tax.filters.find((f) => f.id === fid)
  const apply = (fn, ok) => run(() => api.saveMany(chosen.map(fn)), ok).then(onClose)
  const addTo = () => apply((o) => { const cur = valuesOf(o, fl, tax); return withTags(o, fl.id, cur.includes(val) ? cur : (fl.pick === 'first' || fl.kind === 'level') ? [val] : [...cur, val]) }, `“${val}” added to ${chosen.length} offer(s) ✔`)
  const removeFrom = () => apply((o) => withTags(o, fl.id, valuesOf(o, fl, tax).filter((x) => x !== val)), `“${val}” removed from ${chosen.length} offer(s) ✔`)
  return (<div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="panel small-panel" role="dialog" aria-modal="true">
    <div className="ph"><h3>Classify {chosen.length} offer(s)</h3><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
    <div className="pb">
      <fieldset><legend>Category</legend><label>Category<select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Choose a category…</option>{allCategories([], tax).map((c) => <option key={c}>{c}</option>)}</select></label>
        <div className="row" style={{ marginTop: 12 }}><button className="btn pri" disabled={!cat} onClick={() => apply((o) => withCats(o, [...(isAutoCategory(o) ? [] : categoriesOf(o, tax)), cat]), `Added to “${cat}” ✔`)}>Add to this category</button>
          <button className="btn" disabled={!cat} onClick={() => apply((o) => withCats(o, categoriesOf(o, tax).filter((c) => c !== cat)), `Removed from “${cat}” ✔`)}>Remove from it</button>
          <button className="btn" disabled={!cat} onClick={() => apply((o) => withCats(o, [cat]), `Moved to “${cat}” only ✔`)}>Make it the only one</button></div></fieldset>
      <fieldset><legend>Filter value</legend>
        <label>Filter<select value={fid} onChange={(e) => { setFid(e.target.value); setVal('') }}><option value="">Choose a filter…</option>{tax.filters.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
        {fl && <label>Value<select value={val} onChange={(e) => setVal(e.target.value)}><option value="">Choose a value…</option>{fl.options.map((x) => <option key={x.v} value={x.v}>{optLabel(x)}</option>)}</select></label>}
        {fl && <div className="row" style={{ marginTop: 12 }}><button className="btn pri" disabled={!val} onClick={addTo}>Add this value</button><button className="btn" disabled={!val} onClick={removeFrom}>Remove this value</button>
          <button className="btn" onClick={() => apply((o) => dropTags(o, fl.id), 'Back to automatic ✔')}>Back to automatic</button></div>}
      </fieldset></div>
    <div className="pf"><span className="grow" /><button className="btn" onClick={onClose}>Close</button></div></div></div>)
}
