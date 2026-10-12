-- Generated World: Supabase 설정 (SQL Editor에서 전체 실행, 여러 번 실행해도 안전)

-- 1. 테이블
--    is_ai   : 실제 정답 (나중에 일괄 공개용)
--    verdict : 관객 투표를 보고 호스트가 내린 판정 ('real' | 'ai', 미판정은 null)
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

-- 4. 투표 RPC: voting 상태일 때만 카운트 +1 (원자적 증가라 동시 투표에도 유실 없음)
create or replace function public.vote(video_id text, choice text)
returns void language sql security definer set search_path = public as $$
  update public.videos
  set real_votes = real_votes + (choice = 'real')::int,
      ai_votes   = ai_votes   + (choice = 'ai')::int
  where id = video_id and status = 'voting' and choice in ('real', 'ai');
$$;

-- 5. 판정 RPC: 호스트가 REAL / AI GENERATED를 누르면 판정 저장 + 투표 마감
create or replace function public.decide(video_id text, choice text)
returns void language sql security definer set search_path = public as $$
  update public.videos
  set verdict = choice, status = 'closed'
  where id = video_id and choice in ('real', 'ai');
$$;
drop function if exists public.close_voting(text);

grant execute on function public.vote(text, text) to anon;
grant execute on function public.decide(text, text) to anon;

-- 6. Realtime: videos 변경사항을 웹소켓으로 푸시 (이미 등록돼 있으면 건너뜀)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'videos'
  ) then
    alter publication supabase_realtime add table public.videos;
  end if;
end $$;

-- 7. API가 새 테이블/함수를 바로 인식하도록 갱신
notify pgrst, 'reload schema';

-- 테스트 후 초기화가 필요하면:
-- update public.videos set real_votes = 0, ai_votes = 0, status = 'voting', verdict = null;
