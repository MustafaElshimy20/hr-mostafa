import { useRef } from 'react'
import { SHARE_VARS, SHARE_EMOJIS, DEFAULT_SHARE, shareMessage } from './share'

// Editor for a WhatsApp share message: text box + clickable {placeholders} and emojis + live preview.
export default function ShareEditor({ value, onChange, sample, tax, template, placeholder }) {
  const ta = useRef()
  const insert = (text) => { const el = ta.current, v = value || '', a = el ? el.selectionStart : v.length, b = el ? el.selectionEnd : v.length
    onChange(v.slice(0, a) + text + v.slice(b)); setTimeout(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = a + text.length } }, 0) }
  const link = location.href.split('#')[0] + '#/offer/' + ((sample && sample.id) || '…')
  return (<div className="shareed">
    <textarea ref={ta} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || DEFAULT_SHARE} rows={6} />
    <div className="shbar"><span className="muted small">Insert:</span>{SHARE_VARS.map(([k, l]) => <button type="button" key={k} className="tchip" onClick={() => insert('{' + k + '}')} title={l}>{l}</button>)}</div>
    <div className="shbar emo">{SHARE_EMOJIS.map((e) => <button type="button" key={e} className="emoji" onClick={() => insert(e)}>{e}</button>)}</div>
    {sample && <div className="shprev"><span className="muted small">Preview (how it looks in WhatsApp)</span><div className="bubble">{shareMessage({ ...sample, share_text: value || '' }, tax, template, link)}</div></div>}
  </div>)
}
