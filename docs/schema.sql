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
  debate_id uuid references debates(id) on delete cascade,
  winner text not null,               -- 'affirmative' or 'negative'
  reasoning text not null,            -- overall explanation of the decision
  affirmative_feedback text not null, -- specific feedback for affirmative speaker
  negative_feedback text not null,    -- specific feedback for negative speaker
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security on all tables
alter table allowlist enable row level security;
alter table debates enable row level security;
alter table debate_participants enable row level security;
alter table speeches enable row level security;
alter table judgements enable row level security;

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
    exists (
      select 1 from debate_participants
      where debate_id = debates.id and user_id = auth.uid()
    )
  );

create policy "Authenticated users can create debates"
  on debates for insert
  with check (auth.uid() = created_by);

create policy "Participants can update debate status"
  on debates for update
  using (
    exists (
      select 1 from debate_participants
      where debate_id = debates.id and user_id = auth.uid()
    )
  );

-- Debate participants: visible to participants of that debate
create policy "Participants can view debate participants"
  on debate_participants for select
  using (
    exists (
      select 1 from debate_participants dp
      where dp.debate_id = debate_participants.debate_id and dp.user_id = auth.uid()
    )
  );

create policy "Authenticated users can join debates"
  on debate_participants for insert
  with check (auth.uid() = user_id);

-- Speeches: visible to participants of that debate
create policy "Participants can view speeches"
  on speeches for select
  using (
    exists (
      select 1 from debate_participants
      where debate_id = speeches.debate_id and user_id = auth.uid()
    )
  );

create policy "Participants can insert speeches"
  on speeches for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1 from debate_participants
      where debate_id = speeches.debate_id and user_id = auth.uid()
    )
  );

-- Judgements: visible to participants of that debate
create policy "Participants can view judgements"
  on judgements for select
  using (
    exists (
      select 1 from debate_participants
      where debate_id = judgements.debate_id and user_id = auth.uid()
    )
  );
