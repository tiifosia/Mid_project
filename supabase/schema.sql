-- Generated World: Supabase 설정 (SQL Editor에서 전체 실행, 여러 번 실행해도 안전)

-- 1. 테이블
--    videos  : 영상별 투표 수 (누구나 읽기)
--    answers : 실제 정답 is_ai (true = AI 생성). 접속자에게는 내려가지 않는다 — 정답률은 accuracy RPC 가 서버에서 계산
--    verdict : (이전 호스트 판정용, 지금은 쓰지 않음)
create table if not exists public.videos (
  id         text primary key,
  real_votes integer not null default 0,
  ai_votes   integer not null default 0,
  status     text not null default 'voting' check (status in ('voting', 'closed'))
);
alter table public.videos add column if not exists verdict text check (verdict in ('real', 'ai'));

create table if not exists public.answers (
  video_id text primary key references public.videos (id) on delete cascade,
  is_ai    boolean not null
);

-- 예전 구조(videos.is_ai)에서 옮겨 오기 — 정답을 answers 로 옮기고 videos 에서는 지운다
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'videos' and column_name = 'is_ai'
  ) then
    insert into public.answers (video_id, is_ai) select id, is_ai from public.videos on conflict (video_id) do nothing;
    alter table public.videos drop column is_ai;
  end if;
end $$;

-- 2. 전시 영상 목록 · 정답 (true = AI 생성, false = 실제 촬영)
--    src/videos.js 와 같은 목록. 이 목록에 없는 영상(예전 테스트 영상)은 투표 · 댓글 · 정답과 함께 지운다
delete from public.videos where id not in (
  'clip_01', 'clip_02', 'clip_03', 'clip_04', 'clip_05', 'clip_06', 'clip_07', 'clip_08', 'clip_09'
);
insert into public.videos (id) values
  ('clip_01'), ('clip_02'), ('clip_03'), ('clip_04'), ('clip_05'), ('clip_06'), ('clip_07'),
  ('clip_08'), ('clip_09')
on conflict (id) do nothing;
insert into public.answers (video_id, is_ai) values
  ('clip_01', true),  -- 오스트리아 호수
  ('clip_02', true),  -- 영국 스코틀랜드 하이랜드
  ('clip_03', true),  -- 대만 타이난 외곽
  ('clip_04', true),  -- 필리핀 산
  ('clip_05', true),  -- 몽골 아르항가이 초원
  ('clip_06', true),  -- 헝가리 시골
  ('clip_07', true),  -- 일본 마루노우치 일대
  ('clip_08', true),  -- 핀란드 간이역
  ('clip_09', true)   -- 스위스 산간 지역
on conflict (video_id) do update set is_ai = excluded.is_ai;

-- 3. RLS: 누구나 읽기만 가능, 직접 쓰기는 정책이 없으므로 전부 차단
alter table public.videos enable row level security;
drop policy if exists "anyone can read videos" on public.videos;
create policy "anyone can read videos" on public.videos for select using (true);
-- answers 는 RLS 만 켜고 정책을 두지 않는다 → 접속자는 읽을 수 없다
alter table public.answers enable row level security;

-- 4. 투표 RPC: 카운트 +1 (원자적 증가라 동시 투표에도 유실 없음)
--    모두가 같은 웹페이지에서 직접 투표하므로 마감 없이 항상 받는다
create or replace function public.vote(video_id text, choice text)
returns void language sql security definer set search_path = public as $$
  update public.videos
  set real_votes = real_votes + (choice = 'real')::int,
      ai_votes   = ai_votes   + (choice = 'ai')::int
  where id = video_id and choice in ('real', 'ai');
$$;

-- 5. 호스트 판정 기능은 없어졌다 (마커 색은 실시간 다수결)
drop function if exists public.decide(text, text);
drop function if exists public.close_voting(text);

-- 6. 리셋 RPC: 투표 수 · 마감 · 판정을 처음으로 (정답 answers 는 그대로). 화면 버튼은 없고 필요하면 SQL 로:
--    select public.reset_votes();
create or replace function public.reset_votes()
returns void language sql security definer set search_path = public as $$
  update public.videos
  set real_votes = 0, ai_votes = 0, status = 'voting', verdict = null
  where true;
$$;

-- 4-1. 투표 취소 RPC: 내 한 표를 뺀다 (0 아래로는 내려가지 않음)
create or replace function public.unvote(video_id text, choice text)
returns void language sql security definer set search_path = public as $$
  update public.videos
  set real_votes = greatest(real_votes - (choice = 'real')::int, 0),
      ai_votes   = greatest(ai_votes   - (choice = 'ai')::int, 0)
  where id = video_id and choice in ('real', 'ai');
$$;

grant execute on function public.vote(text, text) to anon;
grant execute on function public.unvote(text, text) to anon;
grant execute on function public.reset_votes() to anon;

-- 6-0. 정답률 RPC: 서버에서 정답과 비교해 개수만 돌려준다 (정답 자체는 내려가지 않음)
--   전체: 한 표라도 받은 영상 중, 다수결이 정답과 같은 영상 (동률은 오답)
--   나  : 이 기기에서 투표한 영상(my_votes = [{video_id, choice}]) 중, 고른 쪽이 정답인 영상
create or replace function public.accuracy(my_votes jsonb default '[]'::jsonb)
returns json language sql stable security definer set search_path = public as $$
  with mine as (
    select m.video_id, m.choice
    from jsonb_to_recordset(coalesce(my_votes, '[]'::jsonb)) as m(video_id text, choice text)
    where m.choice in ('real', 'ai')
  )
  select json_build_object(
    'all_total', (select count(*) from videos v join answers a on a.video_id = v.id
                  where v.real_votes + v.ai_votes > 0),
    'all_correct', (select count(*) from videos v join answers a on a.video_id = v.id
                    where (a.is_ai and v.ai_votes > v.real_votes) or (not a.is_ai and v.real_votes > v.ai_votes)),
    'my_total', (select count(*) from mine join answers a on a.video_id = mine.video_id),
    'my_correct', (select count(*) from mine join answers a on a.video_id = mine.video_id
                   where (mine.choice = 'ai') = a.is_ai)
  );
$$;
grant execute on function public.accuracy(jsonb) to anon;

-- 6-1. 익명 댓글: 영상마다 따로. 누구나 읽기, 쓰기는 add_comment RPC 로만 (1~300자)
create table if not exists public.comments (
  id         bigint generated always as identity primary key,
  video_id   text not null references public.videos (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists comments_video_created on public.comments (video_id, created_at);
alter table public.comments enable row level security;
drop policy if exists "anyone can read comments" on public.comments;
create policy "anyone can read comments" on public.comments for select using (true);

-- 남긴 댓글을 돌려줘서, 실시간 연결이 늦어도 내 화면에는 바로 붙는다
create or replace function public.add_comment(video_id text, body text)
returns public.comments language sql security definer set search_path = public as $$
  insert into public.comments (video_id, body) values (video_id, btrim(body)) returning *;
$$;
grant execute on function public.add_comment(text, text) to anon;

-- 7. Realtime: videos · comments 변경사항을 웹소켓으로 푸시 (이미 등록돼 있으면 건너뜀)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'videos'
  ) then
    alter publication supabase_realtime add table public.videos;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;

-- 8. API가 새 테이블/함수를 바로 인식하도록 갱신
notify pgrst, 'reload schema';

-- 테스트 후 초기화가 필요하면:
-- update public.videos set real_votes = 0, ai_votes = 0, status = 'voting', verdict = null;
