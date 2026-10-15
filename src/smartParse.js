// Smart fill: turns a pasted job post (English / Arabic / mixed, WhatsApp or Facebook style) into offer fields.
// 1) `parseOfferText` works offline, instantly, with no AI and no cost.
// 2) `smartFill` additionally asks the optional AI endpoint (/api/parse-offer) and lets it improve on the local result.
// Nothing is saved by this file – it only returns values for the admin to review in the form.
import { norm, kwRegex, kwsOf, filterById } from './taxonomy'
import { detectSalaryType } from './lib'

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const ar = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d)).replace(/[٫]/g, '.').replace(/[٬،](?=\d{3})/g, ',')
// loose Arabic normalisation used only for matching
const fold = (s) => ar(s).normalize('NFKD').replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim()

const LABELS = {
  company: ['company', 'company name', 'employer', 'client', 'الشركة', 'شركة', 'اسم الشركة', 'الشركه'],
  position: ['position', 'job title', 'title', 'role', 'job', 'vacancy', 'job position', 'الوظيفة', 'الوظيفه', 'المسمى الوظيفي', 'المسمى', 'وظيفة', 'الوظيفة المطلوبة'],
  location: ['location', 'address', 'place', 'area', 'branch', 'job location', 'work location', 'المكان', 'الموقع', 'العنوان', 'مكان العمل', 'الفرع', 'المنطقة'],
  nationality: ['nationality', 'الجنسية', 'الجنسيه'],
  salary: ['salary', 'pay', 'package', 'compensation', 'income', 'الراتب', 'المرتب', 'مرتب', 'السالاري', 'الدخل'],
  shifts: ['shift', 'shifts', 'working hours', 'work hours', 'hours', 'schedule', 'working days', 'days off', 'off days', 'الشيفت', 'الشيفتات', 'شيفت', 'مواعيد العمل', 'ساعات العمل', 'الاجازات', 'الإجازات', 'ايام العمل', 'أيام العمل'],
  age: ['age', 'السن', 'العمر', 'السن المطلوب'],
  education: ['education', 'qualification', 'qualifications', 'educational status', 'education level', 'المؤهل', 'المؤهل الدراسي', 'الدرجة العلمية', 'التعليم', 'المؤهلات'],
  experience: ['experience', 'exp', 'الخبرة', 'خبرة', 'الخبره'],
  military: ['military', 'military status', 'military service', 'التجنيد', 'الموقف من التجنيد', 'موقف التجنيد', 'الجيش'],
  transport: ['transportation', 'transport', 'المواصلات', 'الانتقالات', 'انتقالات'],
  language: ['language', 'languages', 'language level', 'language requirement', 'اللغة', 'اللغات', 'اللغه', 'مستوى اللغة'],
  benefits: ['benefits', 'perks', 'we offer', 'what we offer', 'المزايا', 'المميزات', 'مميزات', 'العرض'],
  steps: ['process', 'steps', 'hiring process', 'recruitment process', 'how to apply', 'application process', 'خطوات التقديم', 'الخطوات', 'طريقة التقديم', 'التقديم'],
  interview_type: ['interview', 'interview type', 'نوع الانترفيو', 'الانترفيو', 'نوع المقابلة', 'المقابلة', 'الانترفيو'],
  interview_time: ['interview time', 'interview date', 'interview days', 'interview schedule', 'interview timing', 'موعد الانترفيو', 'مواعيد الانترفيو', 'موعد المقابلة', 'ايام الانترفيو'],
  link: ['link', 'form', 'apply', 'apply link', 'form link', 'apply here', 'application link', 'لينك', 'رابط', 'لينك التقديم', 'رابط التقديم', 'الفورم', 'فورم'],
  notes: ['notes', 'note', 'important', 'ملاحظات', 'ملحوظة', 'ملاحظة', 'مهم'],
  work_mode: ['work mode', 'work type', 'work system', 'نظام العمل', 'طبيعة العمل'],
}
const LABEL_MAP = new Map()
Object.entries(LABELS).forEach(([k, a]) => a.forEach((l) => LABEL_MAP.set(fold(l), k)))

const LONG = new Set(['benefits', 'steps', 'experience', 'shifts', 'salary', 'transport', 'notes'])
const BULLET = /^\s*(?:[•·▪▫●○■□◆◇★☆✓✔✅☑❌➤➔→⇒►▶\-–—*#>+]|\d{1,2}[.)]|\p{Extended_Pictographic}|️|⃣)+\s*/u
const LISTMARK = /^\s*(?:[•·▪▫●○■□◆◇➤➔►▶\-–—*+]|\d{1,2}[.)]|[✓✔✅☑])\s*\S/u
const strip = (l) => l.replace(BULLET, '').replace(/[‎‏‪-‮]/g, '').trim()
const clean = (s) => String(s ?? '').replace(/\p{Extended_Pictographic}|️|⃣/gu, '').replace(/\s+/g, ' ').replace(/^[\s:–—\-|]+|[\s|]+$/g, '').trim()
const urlOf = (s) => (String(s).match(/https?:\/\/[^\s)>\]]+/i) || [''])[0].replace(/[.,;!?]+$/, '')
const JOB_WORDS = /\b(agent|support|service|representative|rep|specialist|sales|engineer|manager|executive|officer|assistant|coordinator|analyst|developer|designer|accountant|teller|advisor|consultant|supervisor|trainer|recruiter|operator|technician|moderator|reviewer|associate|admin|clerk|driver|nurse|intern|team leader|tl|cs|csr|bpo)\b|دعم|خدمة العملاء|مبيعات|محاسب|مهندس|سكرتير/i

function mapEdu(t) {
  const x = fold(t), out = []
  if (/graduat|grad\b|grads|bachelor|خريج|مؤهل عالي|جامعي|حاصل علي/.test(x)) out.push('Graduates')
  if (/undergrad|student|طالب|طلاب|طلبه|طلبة|لسه في الكلية/.test(x)) out.push('Undergraduates')
  if (/\bgap\b|فجوه|فجوة/.test(x)) out.push('Gap years')
  if (/dropout|drop out|دروب|مفصول|متسرب/.test(x)) out.push('Dropouts')
  return out.length ? out.join(', ') : clean(t)
}
function mapMil(t) {
  const x = fold(t), out = []
  if (/complet|done|finished|خلص|منتهي|اتم|تاديه|تأديه|انهاء/.test(x)) out.push('Completed')
  if (/exempt|معفي|اعفاء|معافي/.test(x)) out.push('Exempted')
  if (/postpon|مؤجل|تاجيل/.test(x)) out.push('Postponed')
  return out.length ? out.join(' / ') : clean(t)
}
function mapMode(t) {
  const x = fold(t)
  if (/hybrid|هايبرد/.test(x)) return 'Hybrid'
  if (/work from home|wfh|remote|ريموت|من البيت|من المنزل|عن بعد/.test(x)) return 'Work from home'
  if (/on-?site|on site|office|مقر|من الشركه|من الشركة/.test(x)) return 'On-site'
  return ''
}
function mapInterview(t) {
  const x = fold(t), on = /online|اونلاين|zoom|teams|call|مكالمه|فيديو|virtual/.test(x), site = /\bsite\b|on-?site|in-?person|face|حضوري|مقر|في الشركه|في الشركة|وجها/.test(x)
  return on && site ? 'Online interview, then site interview' : on ? 'Online interview' : site ? 'Site interview' : ''
}
function fixSalary(t) {
  return clean(ar(t)).replace(/صافي|صافى/g, 'net').replace(/اجمالي|إجمالي|إجمالى|جروس/g, 'gross').replace(/جنيه(?:ا)?(?: مصري)?/g, 'EGP').replace(/\s+/g, ' ').trim()
}
function mapNat(t) {
  const x = fold(t), only = /only|فقط|بس/.test(x)
  if (/egypt|مصري|مصر/.test(x)) return only ? 'Egyptians only' : 'Egyptians'
  return clean(t)
}

const LANGS = [['English', /english|انجليزي|انجليزيه|انكليزي|انجلش/], ['French', /french|فرنسي|فرنسيه|فرنش/], ['German', /german|الماني|المانيه|جيرمان/], ['Italian', /italian|ايطالي|ايطاليه/], ['Spanish', /spanish|اسباني|اسبانيه|سبانش/],
  ['Portuguese', /portuguese|برتغالي|برتغاليه/], ['Dutch', /dutch|هولندي|هولنديه/], ['Polish', /polish|بولندي|بولنديه/], ['Hindi', /hindi|هندي|هنديه/], ['Turkish', /turkish|تركي|تركيه/], ['Russian', /russian|روسي|روسيه/]]
// "French C1 + English B2" from any text that names languages (a level written right after the language is attached to it)
function readLanguages(text, extra = []) {
  const x = fold(text), hits = []
  const all = [...LANGS, ...extra]
  all.forEach(([name, re]) => { const m = re.exec(x); if (m) {
    const after = x.slice(m.index + m[0].length, m.index + m[0].length + 22), before = x.slice(Math.max(0, m.index - 12), m.index)
    const lv = (/^[\s:(\-–/]*([abc][12])\s*\+?/i.exec(after) || /([abc][12])\s*\+?\s*$/i.exec(before) || [])[1]
    const plus = lv && new RegExp('^[\\s:(\\-–/]*' + lv + '\\+', 'i').test(after)
    hits.push([m.index, name + (lv ? ' ' + lv.toUpperCase() + (plus ? '+' : '') : '')]) } })
  return hits.sort((a, b) => a[0] - b[0]).map((h) => h[1]).join(' + ')
}

function readAge(t) {
  const x = ar(t)
  let m = /(\d{2})\s*(?:-|–|to|الي|الى|لـ|ل)\s*(\d{2})/i.exec(x); if (m) return `${m[1]}-${m[2]}`
  m = /(?:max(?:imum)?|up to|اقصي|أقصى|اقل من|لحد|حتى|حتي)\s*(?:age\s*)?:?\s*(\d{2})/i.exec(x); if (m) return `Max ${m[1]}`
  m = /(?:min(?:imum)?|from|اكبر من|من سن)\s*:?\s*(\d{2})\b/i.exec(x); if (m) return `Min ${m[1]}`
  m = /\b(\d{2})\s*\+/.exec(x); if (m) return `${m[1]}+`
  return ''
}

const AR_PLACES = [['مدينه نصر', 'Nasr City'], ['مدينة نصر', 'Nasr City'], ['المعادي', 'Maadi'], ['مصر الجديده', 'Heliopolis'], ['مصر الجديدة', 'Heliopolis'], ['التجمع', 'New Cairo'], ['القطاميه', 'Kattameya'], ['القطامية', 'Kattameya'], ['الشيخ زايد', 'Sheikh Zayed'], ['6 اكتوبر', '6th of October'], ['السادس من اكتوبر', '6th of October'], ['اكتوبر', '6th of October'], ['النزهه', 'El Nozha'], ['النزهة', 'El Nozha'], ['العباسيه', 'Abbasiya'], ['العباسية', 'Abbasiya'], ['وسط البلد', 'Downtown'], ['سموحه', 'Smouha'], ['سموحة', 'Smouha'], ['الاسكندريه', 'Alexandria'], ['الاسكندرية', 'Alexandria'], ['الجيزه', 'Giza'], ['الجيزة', 'Giza'], ['القاهره', 'Cairo'], ['القاهرة', 'Cairo'], ['الغردقه', 'Hurghada'], ['الغردقة', 'Hurghada'], ['سمارت فيلدج', 'Smart Village'], ['القرية الذكية', 'Smart Village']]
const enPlaces = (t) => AR_PLACES.reduce((x, [a, e]) => x.split(a).join(e), String(t))
function areaFromTax(text, tax) {
  if (!tax) return ''
  const x = norm(ar(text)), find = (fl) => { if (!fl) return ''
    let best = null
    fl.options.forEach((o) => kwsOf(o).forEach((k) => { const re = kwRegex(k), m = re && re.exec(x); if (m && (!best || m.index < best.i)) best = { i: m.index, v: o.label || o.v, parent: o.parent } }))
    return best }
  const area = find(filterById(tax, 'area')), gov = find(filterById(tax, 'gov'))
  if (area) return area.parent && gov && gov.v !== area.parent ? area.v : area.parent && !(gov && gov.v === area.parent) ? `${area.v}, ${area.parent}` : area.v
  return gov ? gov.v : ''
}

/** Returns { fields, found: [keys], leftovers: [lines] } */
export function parseOfferText(raw, ctx = {}) {
  const tax = ctx.tax, companies = ctx.companies || []
  const text = ar(String(raw || '')).replace(/\r/g, '')
  const lines = text.split('\n').map((l) => l.replace(/[‎‏‪-‮]/g, ''))
  const out = {}, used = new Set(), free = []
  const put = (k, v, i) => { v = String(v ?? '').trim(); if (!v) return; out[k] = out[k] ? (LONG.has(k) && !out[k].includes(v) ? out[k] + '\n' + v : out[k]) : v; if (i != null) used.add(i) }

  // pass 1 – "Label: value" lines (+ bullet lines that follow a label)
  let cur = null
  lines.forEach((line, i) => {
    const s = strip(line)
    if (!s) { cur = null; return }
    const m = /^([^:：]{2,34}?)\s*[:：]\s*(.*)$/.exec(s)
    const key = m && LABEL_MAP.get(fold(m[1]).replace(/[()]/g, '').trim())
    if (key) { cur = LONG.has(key) ? key : null; put(key, m[2].replace(/^[\s*_]+|[\s*_]+$/g, ''), i); used.add(i); if (!m[2].trim()) cur = key; return }
    if (cur && LISTMARK.test(line)) { put(cur, s, i); return }
    if (cur && !out[cur]) { put(cur, s, i); return }
    cur = null; free.push([i, s])
  })

  // pass 2 – lines without a label
  const takeFree = (k, test, map = (s) => s) => { if (out[k]) return; const hit = free.find(([i, s]) => !used.has(i) && test(s)); if (hit) put(k, map(hit[1]), hit[0]) }
  takeFree('link', (s) => !!urlOf(s), urlOf)
  if (!out.link) { const u = urlOf(text); if (u) out.link = u }
  takeFree('salary', (s) => /(\d[\d,. ]*\s*(egp|le\b|l\.e|جنيه|ج\b|k\b)|\bnet\b|\bgross\b|صافي|اجمالي|إجمالي|salary|راتب|مرتب)/i.test(s) && /\d/.test(s) && !/\b(age|years? experience)\b/i.test(s), (s) => s.replace(/^salary\s*[:\-]?\s*/i, ''))
  takeFree('shifts', (s) => /shift|شيفت|rotat|fixed|days? off|اجاز|\boff\b|sat\b|fri\b|\d\s?(am|pm)\s*[-–to]+\s*\d|\d\s*(ص|م)\s*(الي|الى|-)/i.test(s) && !/interview|انترفيو/i.test(s))
  takeFree('transport', (s) => /transport|مواصلات|انتقالات|bus\b/i.test(s))
  takeFree('benefits', (s) => /insurance|تامين|تأمين|medical|bonus|incentive|حوافز|بدل|allowance|commission|عمولة|عمولات|بونص/i.test(s) && !/\d{2},?\d{3}.*(net|gross)/i.test(s))
  takeFree('experience', (s) => /experience|خبره|خبرة|\bexp\b/i.test(s))
  takeFree('military', (s) => /military|تجنيد|الجيش/i.test(s))
  takeFree('interview_type', (s) => /interview|انترفيو|مقابله|مقابلة/i.test(s) && !!mapInterview(s), mapInterview)
  takeFree('interview_time', (s) => /(interview|انترفيو|مقابله|مقابلة)/i.test(s) && /\d\s?(am|pm|ص|م)|sun|mon|tue|wed|thu|احد|اثنين|ثلاثاء|اربع|خميس/i.test(s), (s) => s.replace(/^.*?(interview|انترفيو|مقابلة|مقابله)[^:\d]*[:\-–]?\s*/i, ''))
  takeFree('steps', (s) => /(->|→|=>|➡|⬅)/.test(s) || /\bthen\b.*\bthen\b/i.test(s), (s) => s.replace(/\s*(->|→|=>|➡)\s*/g, ' -> '))

  // pass 3 – facts that can be read from the whole text
  if (!out.age) { const cand = free.filter(([i, s]) => !used.has(i) && /age|سن|عمر|years|سنه|سنة|\bmax\b/i.test(fold(s))), a = readAge(cand.map(([, s]) => s).join(' ')); if (a) { out.age = a; cand.forEach(([i, s]) => readAge(s) && s.length < 60 && used.add(i)) } }
  else { const a = readAge(out.age); if (a) out.age = a }
  if (out.language) { const l = readLanguages(out.language); if (l && !/[a-z]/i.test(out.language.replace(/[a-z]{3,}/gi, '')) ) out.language = l; else if (l) out.language = l }
  else { const l = readLanguages(text); if (l) { out.language = l; free.forEach(([i, s]) => { if (!used.has(i) && readLanguages(s) && fold(s).replace(/english|french|german|italian|spanish|portuguese|dutch|polish|hindi|turkish|russian|انجليزي|فرنسي|الماني|ايطالي|اسباني|برتغالي|هولندي|بولندي|هندي|\b[abc][12]\+?|and|or|\+|[,&/\-–()]|language|required|مطلوب|لغه|اللغه/gi, '').trim().length < 6) used.add(i) }) } }
  if (out.education) out.education = mapEdu(out.education)
  else { const hit = free.find(([i, s]) => !used.has(i) && /graduat|grads|student|undergrad|gap year|dropout|خريج|طلبه|طلبة|طالب|مؤهل/i.test(fold(s)) && s.length < 90); if (hit) { out.education = mapEdu(hit[1]); used.add(hit[0]) } }
  if (out.military) out.military = mapMil(out.military)
  if (out.nationality) out.nationality = mapNat(out.nationality)
  else { const hit = free.find(([i, s]) => !used.has(i) && /egyptian|مصري|مصريين|nationality|جنسيه/i.test(fold(s)) && s.length < 60); if (hit) { out.nationality = mapNat(hit[1]); used.add(hit[0]) } }
  if (out.interview_type) { const m = mapInterview(out.interview_type); if (m) out.interview_type = m }
  const mode = out.work_mode ? mapMode(out.work_mode) : mapMode(text)
  if (mode) out.work_mode = mode; else delete out.work_mode
  if (out.salary) out.salary = fixSalary(out.salary)
  if (out.steps) out.steps = out.steps.split('\n').map((s) => s.replace(/\s*(->|→|=>|➡)\s*/g, ' -> ').trim()).filter(Boolean).join(out.steps.includes('\n') ? '\n' : ' ')
  if (out.salary) { const t = detectSalaryType({ salary: out.salary }); if (t) out.salary_type = t }

  // location
  if (out.location) out.location = clean(enPlaces(out.location))
  else { const pin = lines.findIndex((l) => /📍|📌/.test(l)), at = pin >= 0 ? clean(strip(lines[pin])) : '', a = areaFromTax(enPlaces(at || text), tax); if (pin >= 0 && at) { out.location = enPlaces(at); used.add(pin) } else if (a) out.location = a }

  // company + position
  const known = companies.find((c) => c && new RegExp('(^|[^a-z0-9])' + norm(c).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(norm(text)))
  const firstIdx = lines.findIndex((l) => strip(l)), head = free.find(([i, s]) => i === firstIdx && !used.has(i) && !urlOf(s) && s.length <= 140)
  const cleanTitle = (t) => clean(t).replace(/^(?:we are |we're |now |urgently |urgent |immediate )*(?:hiring|looking for|required|wanted|vacancy|opening|job opportunity|opportunity)\s*[:\-–!]*\s*/i, '').replace(/^(?:فرصه عمل|فرصة عمل|مطلوب فورا|مطلوب|وظيفه|وظيفة|وظائف|مطلوب للعمل)\s*[:\-–!]*\s*(?:ك|لوظيفه|لوظيفة)?\s*/i, '').replace(/[!.]+$/, '').trim()
  if (head) {
    const [i, s0] = head, s = clean(s0)
    let m
    if (!out.company || !out.position) {
      if ((m = /^(.{2,45}?)\s+(?:is\s+|are\s+)?(?:now\s+)?(?:hiring|looking for|seeking|recruiting|announces?)\s+(?:for\s+|a\s+|an\s+|the\s+)?(.+)$/i.exec(s))) { if (!out.company) out.company = clean(m[1]); if (!out.position) out.position = cleanTitle(m[2]); used.add(i) }
      else if ((m = /^(?:شركه|شركة)?\s*(.{2,40}?)\s+(?:تعلن عن|بتعلن عن|تطلب|محتاجه|محتاجة|عايزه|عايزة|تعلن)\s+(.+)$/.exec(s))) { if (!out.company) out.company = clean(m[1]); if (!out.position) out.position = cleanTitle(m[2]); used.add(i) }
      else if ((m = /^(.{2,60}?)\s+[-–—|@]\s+(.{2,60})$/.exec(s))) {
        const [a, b] = [clean(m[1]), clean(m[2])], isKnown = (x) => known && norm(x).includes(norm(known))
        let comp = isKnown(a) ? a : isKnown(b) ? b : JOB_WORDS.test(b) && !JOB_WORDS.test(a) ? a : JOB_WORDS.test(a) && !JOB_WORDS.test(b) ? b : ''
        if (comp) { const pos = comp === a ? b : a; if (!out.company) out.company = cleanTitle(comp); if (!out.position) out.position = cleanTitle(pos); used.add(i) } }
    }
    if (!out.position && !used.has(i) && s.length <= 90 && !/[:：]/.test(s)) { out.position = cleanTitle(s); used.add(i) }
  }
  if (!out.company && known) out.company = known
  if (out.company) out.company = clean(out.company).replace(/^(?:شركه|شركة|company)\s+/i, '')
  if (out.position) out.position = cleanTitle(out.position)

  // keep a known company's exact spelling
  if (out.company) { const k = companies.find((c) => norm(c) === norm(out.company)); if (k) out.company = k }

  // everything we could not place is kept (hidden from visitors) so no information is lost
  const left = lines.map((l, i) => [i, strip(l)]).filter(([i, s]) => s && !used.has(i) && !free.every(([j]) => j !== i) && clean(s).length > 2).map(([, s]) => s)
  const leftovers = left.filter((s) => !Object.values(out).some((v) => String(v).includes(s)))
  if (leftovers.length) out.internal = leftovers.join('\n')

  const found = Object.keys(out).filter((k) => out[k])
  return { fields: out, found, leftovers }
}

const FIELD_KEYS = ['company', 'position', 'location', 'nationality', 'salary', 'salary_type', 'shifts', 'work_mode', 'age', 'education', 'experience', 'military', 'transport', 'language', 'benefits', 'steps', 'interview_type', 'interview_time', 'link', 'notes', 'internal']

/** Local parse first (instant), then the optional AI endpoint improves it. Always resolves. */
export async function smartFill(text, ctx = {}, askAI) {
  const local = parseOfferText(text, ctx)
  if (!askAI) return { ...local, ai: false }
  try {
    const r = await askAI(text)
    if (!r || typeof r !== 'object') return { ...local, ai: false }
    const fields = { ...local.fields }
    FIELD_KEYS.forEach((k) => { const v = typeof r[k] === 'string' ? r[k].trim() : ''; if (v) fields[k] = v })
    if (fields.salary_type && !['Net', 'Gross', 'Not specified'].includes(fields.salary_type)) delete fields.salary_type
    if (fields.work_mode && !mapMode(fields.work_mode)) delete fields.work_mode; else if (fields.work_mode) fields.work_mode = mapMode(fields.work_mode)
    return { fields, found: Object.keys(fields).filter((k) => fields[k]), leftovers: local.leftovers, ai: true }
  } catch { return { ...local, ai: false } }
}
