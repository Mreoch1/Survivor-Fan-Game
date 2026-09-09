-- Existing duplicates were renamed with the league owner's approval before this
-- migration. Blank names remain optional; named teams must be distinct even when
-- entered concurrently or with different capitalization or extra whitespace.
create unique index profiles_team_name_unique
  on public.profiles (lower(btrim(regexp_replace(team_name, '[[:space:]]+', ' ', 'g'))))
  where btrim(regexp_replace(team_name, '[[:space:]]+', ' ', 'g')) <> '';
