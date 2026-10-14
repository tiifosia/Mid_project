-- Generated World: Supabase 설정 (SQL Editor에서 전체 실행, 여러 번 실행해도 안전)

-- 1. 테이블
--    is_ai   : 실제 정답 (나중에 일괄 공개용)
--    verdict : (이전 호스트 판정용, 지금은 쓰지 않음)
create table if not exists public.videos (
  id         text primary key,
  real_votes integer not null default 0,
  ai_votes   integer not null default 0,
  is_ai      boolean not null,
  status     text not null default 'voting' check (status in ('voting', 'closed'))
);
alter table public.videos add column if not exists verdict text check (verdict in ('real', 'ai'));

-- 2. 더미 데이터 (is_ai 값은 정답에 맞게 수정)
insert into public.videos (id, is_ai) values
  ('video_01', true),
  ('video_02', false),
  ('video_03', true)
on conflict (id) do nothing;

-- 3. RLS: 누구나 읽기만 가능, 직접 쓰기는 정책이 없으므로 전부 차단
alter table public.videos enable row level security;
drop policy if exists "anyone can read videos" on public.videos;
create policy "anyone can read videos" on public.videos for select using (true);

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

-- 6. 리셋 RPC: 투표 수 · 마감 · 판정을 처음으로 (정답 is_ai 는 그대로). 화면 버튼은 없고 필요하면 SQL 로:
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
