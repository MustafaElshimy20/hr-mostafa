# Offerak – Job Offers site (React + Vite)
Run locally: `npm install` then `npm run dev` (works instantly in demo mode, edits saved in your browser only).
Visitors browse offers, filter/search, open an offer's details page and apply via WhatsApp. Admin page: click 'Admin' in the footer (or add `#admin` to the URL).

## Permanent storage (Supabase)
1. Create a free project at supabase.com → SQL Editor → run `supabase/schema.sql`.
2. Authentication → Users → add your email + password (turn off public sign-ups in Providers settings).
3. Copy `.env.example` to `.env` and paste Project URL + anon key.
4. Open `/#admin`, sign in, click **Load starter offers** (once).

## Deploy on Vercel
1. Push this folder to a GitHub repo.
2. vercel.com → Add New Project → import the repo (Vite is detected automatically).
3. Settings → Environment Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.

Edit the form fields in `src/fields.js`. The visitor language filter list is in `src/App.jsx` (LANGS).

## Admin page (`/#admin`)
- Sign in with the Supabase user you created. Offers are grouped by company; click a status pill to open/close an offer instantly.
- **Duplicate** copies an offer (same company) so you can add a similar one quickly. **Select** several offers to reopen, close, delete, or hide their Notes in one click.
- **Notes** are shown to visitors; **Internal notes** are never shown (and not searchable by visitors).
- **Site settings & backup:** site text, WhatsApp number, optional announcement banner, JSON/CSV export, JSON import, change password.
- Optional extra security: edit and run `supabase/lock-to-owner.sql` so only your email can write data.

- **Salary Type (Net / Gross / Not specified):** set in the offer form under Pay & schedule; it shows as a small label next to the salary on the offer card and on the details page. If you do not choose, it is read from the salary text (the first of the words "net" / "gross"). To set it for many offers at once, tick them in the Offers list and use the "Salary type…" dropdown.
- **Salary on the cards:** the first amount written in the Salary box is shown (e.g. "12,000 EGP Net"; a range like 7,000-10,000 is shown as a range). "Up to" appears only when the salary text itself starts with "Up to". On the details page the Net / Gross label sits right after that amount.

## Search & filters (Admin → Filters)
The website is built around the search box and the filters. There are no category chips any more; old category data stays untouched inside your offers and is simply not used.
- **Search** reads job title, company, location, language, salary, benefits, requirements and every filter value (so "cairo" finds Nasr City offers). Several words must all match; commas and accents are ignored.
- **Filters tab** – show / hide a filter, rename it, reorder it, add your own (e.g. Experience, Job type), and add / rename / delete its values. "Detect from" tells the site which offer field to read for the values' keywords (whole words only; `grad*` = word beginnings). Choose "Nothing" to assign offers by hand only.
- **In an offer's edit form** – tick the values for each filter, or leave a filter on *automatic*. What you tick always wins over detection.
- **Offers tab → select offers → Classify…** – add / remove a filter value for many offers at once.
- Everything is saved in Supabase (table `site_settings`, key `taxonomy`; per-offer choices live inside each offer). **No SQL change is needed.**
- The numbers beside every option are exact: they equal the number of results you get by choosing it. Options with 0 results are greyed out. On phones the filters fold behind a "Show filters" button.

## WhatsApp share message (Admin → Site settings & backup)
- Write the message visitors send when they tap "Share on WhatsApp". Click the buttons to insert details that change per offer (`{position}`, `{company}`, `{salary}`, `{area}`, `{language}`, `{link}`…) and click emojis to add icons. A line whose detail is empty for an offer is dropped, so there are no blank "💰 " lines. The offer link is always added at the end if you forget `{link}`.
- A single offer can have its own message: Edit offer → "WhatsApp share message (optional)". Empty = the site message; the site message empty = the standard one.

## Search
Best match first, matched words highlighted, small typing mistakes accepted when nothing matches exactly (e.g. "custmer servce"), Arabic digits understood.

## Offer page layout
Key details (salary, location, language, experience) sit in the side card with the **Apply via WhatsApp** button; everything else is in four sections: Salary & benefits, Work & interview details, Requirements, How to apply. Texts separated by `;` become bullet lists, benefits get ticks, steps written with `→` become numbered steps. This is display only – the stored offer text is never changed. A long value (e.g. a list of 7 locations) is summarised in the side card and written in full in its section.

## Smart fill (paste the offer text → the form fills itself)
In Admin → **+ New offer**, paste the job post (English, Arabic or mixed) into the **✨ Smart fill** box and press **Fill the form**. Company, position, location, salary (and Net/Gross), shifts, age, education, languages & levels, interview, link… are filled and highlighted for you to review. Nothing is saved until you press **Save offer**. Text it cannot place goes to *Internal notes* (hidden from visitors).
It works offline with no setup. **Optional AI boost (free):** create a key at aistudio.google.com, then in Vercel → Settings → Environment Variables add `GEMINI_API_KEY` and redeploy. The AI call runs in `api/parse-offer.js` (the key stays on the server, only a signed-in admin can use it) and falls back to the offline reader if it is unavailable. Optional `GEMINI_MODEL` overrides the model name. Free-tier prompts may be used by Google, so don't paste candidates' personal data.

## Copyright
© Mostafa. All rights reserved. The footer shows the owner name set in Admin → Site settings ("Owner name"). The code, design and content may not be copied or reused without written permission.

## Apply message
The text that reaches you on WhatsApp when a candidate taps **Apply via WhatsApp**. Edit it in Admin → Site settings → **Apply message** (placeholders like job title, company, area, salary + emojis, with a live preview), or give one offer its own message in that offer's edit form. Empty = the original standard message.
