-- Run in Supabase -> SQL Editor
create table if not exists offers (id uuid primary key default gen_random_uuid(), data jsonb not null, created_at timestamptz default now());
create table if not exists site_settings (key text primary key, value text);
alter table offers enable row level security;
alter table site_settings enable row level security;
create policy "public read offers" on offers for select using (true);
create policy "public read settings" on site_settings for select using (true);
create policy "admin write offers" on offers for all to authenticated using (true) with check (true);
create policy "admin write settings" on site_settings for all to authenticated using (true) with check (true);
