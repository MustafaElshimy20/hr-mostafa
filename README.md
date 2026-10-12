# HR Mostafa – Job Offers site (React + Vite)
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
