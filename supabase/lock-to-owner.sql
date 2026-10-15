-- OPTIONAL extra security: only YOUR email can change offers/settings (even if another account were ever created).
-- 1) Replace YOUR-EMAIL@example.com below with the email of your Supabase admin user.  2) Run in SQL Editor.
drop policy if exists "admin write offers" on offers;
drop policy if exists "admin write settings" on site_settings;
create policy "owner write offers" on offers for all to authenticated
  using ((auth.jwt() ->> 'email') = 'YOUR-EMAIL@example.com') with check ((auth.jwt() ->> 'email') = 'YOUR-EMAIL@example.com');
create policy "owner write settings" on site_settings for all to authenticated
  using ((auth.jwt() ->> 'email') = 'YOUR-EMAIL@example.com') with check ((auth.jwt() ->> 'email') = 'YOUR-EMAIL@example.com');
