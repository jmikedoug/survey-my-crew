-- Poll-Your-People — full schema bootstrap for a self-owned Supabase project.
-- Run once against a fresh project:  supabase db push   (or paste into the SQL editor)

-- ---------------------------------------------------------------- extensions
create extension if not exists pgcrypto;

-- --------------------------------------------------------------------- enums
do $$ begin
  create type public.question_type as enum ('rating','choice','text','yes_no','product_suggestion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.affiliate_source as enum ('amazon','etsy','creator','other');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------- utilities
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at = now(); return new; end;
$$;

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  amazon_tag text,
  etsy_tag text,
  age_range text,
  gender text,
  location_region text,
  ethnicity text[],
  hair_type text,
  interests text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles owner read"   on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles owner insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- surveys
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text,
  creator_token text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- NOTE: creator_token is a bearer secret for anonymous ownership claims.
-- Column-level grants keep it out of every public/authenticated read.
grant insert on public.surveys to anon, authenticated;
grant update, delete on public.surveys to authenticated;
grant select (id, slug, title, description, category, user_id, created_at) on public.surveys to anon, authenticated;
grant all on public.surveys to service_role;
alter table public.surveys enable row level security;
create policy "surveys public read"   on public.surveys for select using (true);
create policy "surveys anon insert"   on public.surveys for insert with check (creator_token is not null and length(creator_token) >= 8);
create policy "surveys owner update"  on public.surveys for update to authenticated using (user_id is not null and auth.uid() = user_id) with check (user_id is not null and auth.uid() = user_id);
create policy "surveys owner delete"  on public.surveys for delete to authenticated using (user_id is not null and auth.uid() = user_id);

-- ----------------------------------------------------------------- questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  position integer not null,
  type public.question_type not null,
  prompt text not null,
  options jsonb
);
grant select on public.questions to anon, authenticated;
grant insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "questions public read" on public.questions for select using (true);
create policy "questions owner write" on public.questions for insert to authenticated
  with check (exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()));
create policy "questions owner update" on public.questions for update to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()));
create policy "questions owner delete" on public.questions for delete to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()));

-- ----------------------------------------------------------------- responses
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  respondent_name text,
  user_id uuid references auth.users(id) on delete set null,
  respondent_token text,
  created_at timestamptz not null default now()
);
grant insert on public.responses to anon, authenticated;
grant select on public.responses to authenticated;
grant all on public.responses to service_role;
alter table public.responses enable row level security;
create policy "Anyone can submit survey responses" on public.responses for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy "responses owner read" on public.responses for select to authenticated using (
  (user_id is not null and auth.uid() = user_id)
  or exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid())
);

-- ------------------------------------------------------------------- answers
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  value_number numeric,
  value_text text,
  value_choice text,
  suggested_url text
);
grant insert on public.answers to anon, authenticated;
grant select on public.answers to authenticated;
grant all on public.answers to service_role;
alter table public.answers enable row level security;
create policy "Anyone can submit response answers" on public.answers for insert to anon, authenticated
  with check (response_id is not null and question_id is not null);
create policy "answers owner read" on public.answers for select to authenticated using (
  exists (
    select 1 from public.responses r
    left join public.surveys s on s.id = r.survey_id
    where r.id = response_id
      and ((r.user_id is not null and r.user_id = auth.uid())
        or (s.user_id is not null and s.user_id = auth.uid()))
  )
);

-- ----------------------------------------------------------- affiliate links
create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid references public.surveys(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  label text not null,
  url text not null,
  source public.affiliate_source not null default 'other',
  created_at timestamptz not null default now()
);
grant select on public.affiliate_links to anon, authenticated;
grant insert, update, delete on public.affiliate_links to authenticated;
grant all on public.affiliate_links to service_role;
alter table public.affiliate_links enable row level security;
create policy "aff public read" on public.affiliate_links for select using (true);
-- survey_id must be non-null: a null-survey link has no owner and could be used
-- as an open-redirect record.
create policy "aff owner write" on public.affiliate_links for insert to authenticated
  with check (survey_id is not null and exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()));
create policy "aff owner update" on public.affiliate_links for update to authenticated
  using (survey_id is not null and exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()))
  with check (survey_id is not null and exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()));
create policy "aff owner delete" on public.affiliate_links for delete to authenticated
  using (survey_id is not null and exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()));

-- ---------------------------------------------------------- affiliate clicks
create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_link_id uuid not null references public.affiliate_links(id) on delete cascade,
  referrer text,
  clicked_at timestamptz not null default now()
);
grant insert on public.affiliate_clicks to anon, authenticated;
grant select on public.affiliate_clicks to authenticated;
grant all on public.affiliate_clicks to service_role;
alter table public.affiliate_clicks enable row level security;
create policy "clicks insert valid" on public.affiliate_clicks for insert to anon, authenticated
  with check (exists (select 1 from public.affiliate_links l where l.id = affiliate_link_id));
create policy "clicks owner read" on public.affiliate_clicks for select to authenticated using (
  exists (
    select 1 from public.affiliate_links l
    join public.surveys s on s.id = l.survey_id
    where l.id = affiliate_link_id and s.user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------- audiences
create table public.audiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.audiences to authenticated;
grant all on public.audiences to service_role;
alter table public.audiences enable row level security;
create policy "audiences owner all" on public.audiences for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create trigger audiences_updated_at before update on public.audiences for each row execute function public.touch_updated_at();

create table public.survey_audiences (
  survey_id uuid not null references public.surveys(id) on delete cascade,
  audience_id uuid not null references public.audiences(id) on delete cascade,
  quota integer,
  created_at timestamptz not null default now(),
  primary key (survey_id, audience_id)
);
grant select, insert, update, delete on public.survey_audiences to authenticated;
grant all on public.survey_audiences to service_role;
alter table public.survey_audiences enable row level security;
create policy "survey_audiences owner all" on public.survey_audiences for all to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.surveys s where s.id = survey_id and s.user_id = auth.uid()));

-- ------------------------------------------------------- new-user onboarding
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- --------------------------------------------------------- ownership claims
create or replace function public.claim_surveys(_token text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare _uid uuid := auth.uid(); _n int;
begin
  if _uid is null or _token is null or length(_token) < 8 then return 0; end if;
  update public.surveys set user_id = _uid where creator_token = _token and user_id is null;
  get diagnostics _n = row_count;
  return _n;
end;
$$;
revoke execute on function public.claim_surveys(text) from public, anon;
grant execute on function public.claim_surveys(text) to authenticated;

create or replace function public.claim_responses(_token text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare _uid uuid := auth.uid(); _n int;
begin
  if _uid is null or _token is null or length(_token) < 8 then return 0; end if;
  update public.responses set user_id = _uid where respondent_token = _token and user_id is null;
  get diagnostics _n = row_count;
  return _n;
end;
$$;
revoke execute on function public.claim_responses(text) from public, anon;
grant execute on function public.claim_responses(text) to authenticated;

-- ------------------------------------------------------------- duplication
create or replace function public.duplicate_survey(_slug text, _new_slug text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare _uid uuid := auth.uid(); _src public.surveys%rowtype; _new_id uuid;
begin
  if _uid is null then raise exception 'auth required'; end if;
  select * into _src from public.surveys where slug = _slug;
  if not found then raise exception 'not found'; end if;

  insert into public.surveys (slug, title, description, category, creator_token, user_id)
  values (_new_slug, _src.title || ' (copy)', _src.description, _src.category, encode(gen_random_bytes(16),'hex'), _uid)
  returning id into _new_id;

  insert into public.questions (survey_id, position, type, prompt, options)
  select _new_id, position, type, prompt, options from public.questions where survey_id = _src.id;

  insert into public.affiliate_links (survey_id, question_id, label, url, source)
  select _new_id, null, label, url, source from public.affiliate_links where survey_id = _src.id;

  return _new_slug;
end;
$$;
revoke execute on function public.duplicate_survey(text, text) from public, anon;
grant execute on function public.duplicate_survey(text, text) to authenticated;

-- ---------------------------------------------------------------- discovery
create or replace function public.discover_polls(_only_matching boolean, _category text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare _uid uuid := auth.uid(); _prof public.profiles%rowtype; _rows jsonb;
begin
  if _uid is null then raise exception 'auth required'; end if;
  select * into _prof from public.profiles where id = _uid;

  select coalesce(jsonb_agg(row_to_json(t) order by (t->>'created_at') desc), '[]'::jsonb) into _rows
  from (
    select s.slug, s.title, s.category, s.description, s.created_at,
      (select count(*) from public.responses r where r.survey_id = s.id) as response_count,
      case when not exists (select 1 from public.survey_audiences sa where sa.survey_id = s.id) then null
           when exists (
             select 1 from public.survey_audiences sa
             join public.audiences a on a.id = sa.audience_id
             where sa.survey_id = s.id
               and ((a.criteria->'age_ranges' is null or jsonb_array_length(a.criteria->'age_ranges') = 0
                      or (_prof.age_range is not null and a.criteria->'age_ranges' ? _prof.age_range))
                and (a.criteria->>'gender' is null or a.criteria->>'gender' = 'any' or a.criteria->>'gender' = ''
                      or (_prof.gender is not null and lower(a.criteria->>'gender') = lower(_prof.gender)))
                and (a.criteria->>'location_contains' is null or a.criteria->>'location_contains' = ''
                      or (_prof.location_region is not null
                          and position(lower(a.criteria->>'location_contains') in lower(_prof.location_region)) > 0)))
           ) then 'match'
           else 'browse'
      end as match_reason
    from public.surveys s
    where (_category is null or _category = '' or s.category ilike _category)
    order by s.created_at desc
    limit 200
  ) t
  where (not _only_matching or t.match_reason = 'match');

  return coalesce(_rows, '[]'::jsonb);
end;
$$;
revoke execute on function public.discover_polls(boolean, text) from public, anon;
grant execute on function public.discover_polls(boolean, text) to authenticated;

-- ------------------------------------------------------------------ results
-- Intentionally callable by anon: shared results pages are public, and this
-- function returns aggregates only (never respondent names or tokens).
create or replace function public.get_survey_results(_slug text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare _survey public.surveys%rowtype; _result jsonb;
begin
  select * into _survey from public.surveys where slug = _slug;
  if not found then return null; end if;

  select jsonb_build_object(
    'survey', jsonb_build_object(
      'id', _survey.id, 'slug', _survey.slug, 'title', _survey.title,
      'description', _survey.description, 'category', _survey.category, 'created_at', _survey.created_at
    ),
    'response_count', (select count(*) from public.responses r where r.survey_id = _survey.id),
    'questions', coalesce((
      select jsonb_agg(q_data order by position)
      from (
        select q.position, jsonb_build_object(
          'id', q.id, 'position', q.position, 'type', q.type, 'prompt', q.prompt, 'options', q.options,
          'answer_count', (select count(*) from public.answers a where a.question_id = q.id),
          'avg_rating', case when q.type::text = 'rating'
            then (select avg(a.value_number) from public.answers a where a.question_id = q.id) else null end,
          'choice_counts', case when q.type::text in ('choice','yes_no') then (
              select coalesce(jsonb_object_agg(choice, cnt), '{}'::jsonb) from (
                select a.value_choice as choice, count(*) as cnt from public.answers a
                where a.question_id = q.id and a.value_choice is not null group by a.value_choice
              ) s) else null end,
          'text_answers', case when q.type::text = 'text' then (
              select coalesce(jsonb_agg(a.value_text), '[]'::jsonb) from public.answers a
              where a.question_id = q.id and a.value_text is not null) else null end,
          'product_suggestions', case when q.type::text = 'product_suggestion' then (
              select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
                select coalesce(a.value_text, 'Unnamed') as title,
                  (array_agg(a.suggested_url) filter (where a.suggested_url is not null))[1] as url,
                  count(*) as votes
                from public.answers a where a.question_id = q.id
                group by coalesce(a.value_text, 'Unnamed') order by count(*) desc limit 20
              ) t) else null end
        ) as q_data
        from public.questions q where q.survey_id = _survey.id
      ) s
    ), '[]'::jsonb)
  ) into _result;

  return _result;
end;
$$;
grant execute on function public.get_survey_results(text) to anon, authenticated;
