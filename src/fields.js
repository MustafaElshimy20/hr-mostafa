// [key, label, long?, dropdown options?]  – edit this list to add/remove fields everywhere
export const FIELDS = [
  ['company', 'Company'], ['position', 'Position'], ['location', 'Location'], ['nationality', 'Nationality'],
  ['salary', 'Salary (EGP / month)', 1], ['salary_type', 'Salary Type', 0, ['Net', 'Gross', 'Not specified']], ['shifts', 'Shifts', 1], ['work_mode', 'Work Mode', 0, ['On-site', 'Work from home', 'Hybrid']],
  ['age', 'Age'], ['education', 'Educational Status'],
  ['experience', 'Experience', 1], ['military', 'Military'], ['transport', 'Transportation', 1], ['language', 'Language & Level'],
  ['benefits', 'Benefits', 1], ['steps', 'Form Process', 1], ['interview_type', 'Interview Type'], ['interview_time', 'Interview Date & Time'],
  ['link', 'Form Link'], ['notes', 'Notes (shown to visitors)', 1], ['internal', 'Internal notes (hidden from visitors)', 1],
  ['status', 'Status', 0, ['Open', 'Closed']],
]
// how the edit form is grouped
export const SECTIONS = [
  ['Basics', ['company', 'position', 'location', 'work_mode', 'status']],
  ['Pay & schedule', ['salary', 'salary_type', 'shifts', 'benefits', 'transport']],
  ['Requirements', ['education', 'age', 'nationality', 'military', 'experience', 'language']],
  ['How to apply', ['interview_type', 'interview_time', 'steps', 'link']],
  ['Notes', ['notes', 'internal']],
]
export const HINTS = { company: 'e.g. Teleperformance', position: 'e.g. French Customer Service', location: 'e.g. Nasr City', salary: 'e.g. 15,000 net + commission', age: 'e.g. 18-30',
  education: 'e.g. Graduates, undergrads, gap years', language: 'e.g. English B2+  or  French C1 + English B2', link: 'https://…', interview_type: 'e.g. Online interview / Site interview', interview_time: 'e.g. Sun-Thu, 11 AM-5 PM' }
export const SETTINGS = [['title', 'Site title'], ['intro', 'Welcome text', 1], ['whatsapp', 'WhatsApp number (with country code)'], ['banner', 'Announcement banner (optional, shown at the top of the site)', 1], ['footer', 'Footer text', 1]]
