-- Generated World: Supabase 초기 설정 (SQL Editor에서 전체 실행)

-- 1. 테이블
create table public.videos (
  id         text primary key,
  real_votes integer not null default 0,
  ai_votes   integer not null default 0,
  is_ai      boolean not null,
  status     text not null default 'voting' check (status in ('voting', 'closed'))
);

-- 2. 더미 데이터 (is_ai 값은 정답에 맞게 수정)
insert into public.videos (id, is_ai) values
  ('video_01', true),
  ('video_02', false),
  ('video_03', true);

-- 3. RLS: 누구나 읽기만 가능, 직접 쓰기(insert/update/delete)는 정책이 없으므로 전부 차단
alter table public.videos enable row level security;

create policy "anyone can read videos"
  on public.videos for select
  using (true);

-- 4. 투표 RPC: voting 상태일 때만 카운트 +1 (원자적 증가라 동시 투표에도 유실 없음)
create function public.vote(video_id text, choice text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.videos
  set real_votes = real_votes + (choice = 'real')::int,
      ai_votes   = ai_votes   + (choice = 'ai')::int
  where id = video_id
    and status = 'voting'
    and choice in ('real', 'ai');
$$;

-- 5. 투표 마감 RPC (호스트 화면의 '투표 마감 및 결과 공개' 버튼용)
create function public.close_voting(video_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.videos set status = 'closed' where id = video_id;
$$;

grant execute on function public.vote(text, text) to anon;
grant execute on function public.close_voting(text) to anon;

-- 6. Realtime: videos 변경사항을 웹소켓으로 푸시
alter publication supabase_realtime add table public.videos;
