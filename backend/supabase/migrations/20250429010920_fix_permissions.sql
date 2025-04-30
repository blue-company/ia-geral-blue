-- Fix permissions for get_accounts function
grant usage on schema public to anon, authenticated;
grant usage on schema basejump to anon, authenticated;
grant execute on function public.get_accounts() to anon, authenticated;
grant select on basejump.accounts to anon, authenticated;
grant select on basejump.account_user to anon, authenticated;
