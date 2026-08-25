-- Give every player an original island-game avatar without storing uploads.
alter table public.profiles
  add column avatar_key text not null default 'torch'
  constraint profiles_avatar_key_check
  check (avatar_key in ('torch','compass','palm','shark','idol','snake','wave','island'));
