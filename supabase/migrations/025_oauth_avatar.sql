-- Google OAuth stores the profile photo in avatar_url or picture.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      ''
    ),
    new.raw_user_meta_data->>'phone',
    'cliente',
    nullif(
      coalesce(
        nullif(new.raw_user_meta_data->>'avatar_url', ''),
        nullif(new.raw_user_meta_data->>'picture', '')
      ),
      ''
    )
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;

-- Accounts that already signed in with Google keep an empty avatar until this runs.
update public.profiles p
set avatar_url = sub.url
from (
  select
    u.id,
    coalesce(
      nullif(u.raw_user_meta_data->>'avatar_url', ''),
      nullif(u.raw_user_meta_data->>'picture', ''),
      (
        select coalesce(
          nullif(i.identity_data->>'avatar_url', ''),
          nullif(i.identity_data->>'picture', '')
        )
        from auth.identities i
        where i.user_id = u.id
          and i.provider = 'google'
        limit 1
      )
    ) as url
  from auth.users u
) sub
where p.id = sub.id
  and sub.url is not null
  and (p.avatar_url is null or btrim(p.avatar_url) = '');
