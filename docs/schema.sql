-- Allowlist table: controls who can access the app
create table allowlist (
  email text primary key
);

-- Debates table: stores each debate session
create table debates (
  id uuid primary key default gen_random_uuid(),
  topic_area text not null,           -- e.g. "U.S. Politics"
  resolution text not null,           -- e.g. "Sports gambling should be made illegal"
  status text not null default 'waiting', -- waiting | in_progress | complete
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- Debate participants: tracks which user is on which side
create table debate_participants (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid references debates(id) on delete cascade,
  user_id uuid references auth.users(id),
  side text not null, -- 'affirmative' or 'negative'
  unique(debate_id, user_id),
  unique(debate_id, side)
);

-- Speeches: stores transcripts and audio for each speech
create table speeches (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid references debates(id) on delete cascade,
  user_id uuid references auth.users(id),
  round integer not null,             -- 1 = opening, 2 = rebuttal
  audio_url text,                     -- path to audio file in Supabase storage
  transcript text,                    -- transcribed text from Whisper
  created_at timestamp with time zone default now()
);

-- Judgements: stores AI judge results
create table judgements (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid references debates(id) on delete cascade unique, -- one verdict per debate
  winner text not null,               -- 'affirmative' or 'negative'
  reasoning text not null,            -- overall explanation of the decision
  affirmative_feedback text not null, -- specific feedback for affirmative speaker
  negative_feedback text not null,    -- specific feedback for negative speaker
  -- Per-category 1-10 scores from the AI judge (nullable: predate the scores feature)
  aff_argumentation smallint,
  aff_evidence smallint,
  aff_rebuttal smallint,
  neg_argumentation smallint,
  neg_evidence smallint,
  neg_rebuttal smallint,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security on all tables
alter table allowlist enable row level security;
alter table debates enable row level security;
alter table debate_participants enable row level security;
alter table speeches enable row level security;
alter table judgements enable row level security;

-- Membership helper: returns true if the current user is a participant of the
-- given debate. Declared SECURITY DEFINER so the inner query runs as the
-- function owner and BYPASSES RLS — this is what prevents infinite recursion
-- when policies on debate_participants (and tables that reference it) need to
-- check membership. search_path is pinned to public for safety.
create or replace function public.is_debate_participant(_debate_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from debate_participants
    where debate_id = _debate_id
      and user_id = auth.uid()
  );
$$;

-- RLS Policies

-- Allowlist: only readable by the app (server-side check)
create policy "Allow server to read allowlist"
  on allowlist for select
  using (true);

-- Debates: users can see debates they're part of, or that are waiting for an opponent
create policy "Users can view their debates or open debates"
  on debates for select
  using (
    auth.uid() = created_by or
    status = 'waiting' or
    public.is_debate_participant(id)
  );

create policy "Authenticated users can create debates"
  on debates for insert
  with check (auth.uid() = created_by);

create policy "Participants can update debate status"
  on debates for update
  using ( public.is_debate_participant(id) );

-- Debate participants: visible to participants of that debate
create policy "Participants can view debate participants"
  on debate_participants for select
  using ( public.is_debate_participant(debate_id) );

create policy "Authenticated users can join debates"
  on debate_participants for insert
  with check (auth.uid() = user_id);

-- Speeches: visible to participants of that debate
create policy "Participants can view speeches"
  on speeches for select
  using ( public.is_debate_participant(speeches.debate_id) );

create policy "Participants can insert speeches"
  on speeches for insert
  with check (
    auth.uid() = user_id and
    public.is_debate_participant(speeches.debate_id)
  );

-- Judgements: visible to participants of that debate
create policy "Participants can view judgements"
  on judgements for select
  using ( public.is_debate_participant(judgements.debate_id) );

-- ── Storage RLS (private 'speeches' bucket) ──────────────────────────────────
-- The Storage API rejects the new sb_secret service-role key ("Invalid Compact
-- JWS"), so speech audio is uploaded/read with the user's authenticated JWT.
-- Path layout is {debateId}/{userId}-round{n}.webm, so foldername(name)[1] is
-- the debate id; a user may only touch files in a debate they participate in.

create policy "Participants can upload speech audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'speeches'
    and public.is_debate_participant( ((storage.foldername(name))[1])::uuid )
  );

create policy "Participants can update speech audio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'speeches'
    and public.is_debate_participant( ((storage.foldername(name))[1])::uuid )
  )
  with check (
    bucket_id = 'speeches'
    and public.is_debate_participant( ((storage.foldername(name))[1])::uuid )
  );

create policy "Participants can read speech audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'speeches'
    and public.is_debate_participant( ((storage.foldername(name))[1])::uuid )
  );

-- ── Privileges (GRANTs) ──────────────────────────────────────────────────────
-- RLS policies decide WHICH rows a role can touch, but the role also needs
-- table-level privileges first — otherwise access is denied before any policy is
-- evaluated (Postgres "permission denied for table ..."). These must be granted
-- explicitly here; Supabase's defaults don't cover this project's tables.

-- App users (a user JWT, from the browser or a server route) act through RLS:
grant select, insert, update on public.debates to authenticated;
grant select, insert on public.debate_participants to authenticated;
grant select, insert on public.speeches to authenticated;
grant select on public.judgements to authenticated;   -- verdicts are written server-side only
grant select on public.allowlist to authenticated;

-- Service role (trusted server code) bypasses RLS and needs full access:
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
