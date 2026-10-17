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
--    src/videos.js 와 같은 목록. 이 목록에 없는 영상(예전 영상)은 투표 · 댓글 · 정답과 함께 지운다
delete from public.videos where id not in (
  'v01', 'v02', 'v03', 'v04', 'v05', 'v06', 'v07', 'v08', 'v09', 'v10',
  'v11', 'v12', 'v13', 'v14', 'v15', 'v16', 'v17', 'v18', 'v19', 'v20',
  'v21', 'v22', 'v23', 'v24', 'v25', 'v26', 'v27', 'v28', 'v29', 'v30',
  'v31', 'v32', 'v33', 'v34', 'v35', 'v36', 'v37', 'v38', 'v39', 'v40',
  'v41', 'v42', 'v43', 'v44', 'v45', 'v46', 'v47', 'v48', 'v49', 'v50',
  'v51', 'v52', 'v53', 'v54', 'v55', 'v56', 'v57', 'v58', 'v59', 'v60'
);
insert into public.videos (id) values
  ('v01'), ('v02'), ('v03'), ('v04'), ('v05'), ('v06'), ('v07'), ('v08'), ('v09'), ('v10'),
  ('v11'), ('v12'), ('v13'), ('v14'), ('v15'), ('v16'), ('v17'), ('v18'), ('v19'), ('v20'),
  ('v21'), ('v22'), ('v23'), ('v24'), ('v25'), ('v26'), ('v27'), ('v28'), ('v29'), ('v30'),
  ('v31'), ('v32'), ('v33'), ('v34'), ('v35'), ('v36'), ('v37'), ('v38'), ('v39'), ('v40'),
  ('v41'), ('v42'), ('v43'), ('v44'), ('v45'), ('v46'), ('v47'), ('v48'), ('v49'), ('v50'),
  ('v51'), ('v52'), ('v53'), ('v54'), ('v55'), ('v56'), ('v57'), ('v58'), ('v59'), ('v60')
on conflict (id) do nothing;
insert into public.answers (video_id, is_ai) values
  ('v01', false),  -- 아이슬란드
  ('v02', true ),  -- 스코틀랜드 하이랜드 (글렌코)
  ('v03', true ),  -- 노르웨이 (게이랑에르)
  ('v04', false),  -- 핀란드 투르쿠 아우라강
  ('v05', true ),  -- 핀란드 간이역 (탐페레 근교)
  ('v06', false),  -- 핀란드 헬싱키
  ('v07', true ),  -- 핀란드 라플란드
  ('v08', false),  -- 미국 오로빌 (캘리포니아)
  ('v09', true ),  -- 미국 오리건주
  ('v10', true ),  -- 캐나다 (밴프)
  ('v11', false),  -- 미국 라스베이거스 벨라지오
  ('v12', false),  -- 미국 그랜드캐니언
  ('v13', false),  -- 미국 뉴욕
  ('v14', false),  -- 캐나다 퀘벡
  ('v15', true ),  -- 포르투갈 세하 다 이스트렐라
  ('v16', false),  -- 스코틀랜드 에든버러
  ('v17', false),  -- 영국 카운티더럼
  ('v18', false),  -- 레만호 동쪽 끝 (몽트뢰)
  ('v19', true ),  -- 스위스 산간 지역 (베르너 오버란트)
  ('v20', false),  -- 스위스 취리히
  ('v21', true ),  -- 독일 로젠펠트
  ('v22', false),  -- 오스트리아 암파스
  ('v23', true ),  -- 오스트리아 할슈타트 호수
  ('v24', false),  -- 오스트리아 그륀부르크
  ('v25', false),  -- 크로아티아 두브로브니크
  ('v26', false),  -- 폴란드 올레호프
  ('v27', true ),  -- 헝가리 시골 (대평원)
  ('v28', true ),  -- 그리스
  ('v29', false),  -- 불가리아 보테브그라드
  ('v30', true ),  -- 루마니아 황무지
  ('v31', false),  -- 튀르키예 이스탄불 쉬틀뤼제 선착장
  ('v32', false),  -- 튀르키예 이스탄불 쉬틀뤼제 선착장
  ('v33', true ),  -- 몽골 아르항가이 초원
  ('v34', false),  -- 몽골 울란바토르
  ('v35', true ),  -- 멕시코
  ('v36', false),  -- 모로코 마라케시
  ('v37', false),  -- 모로코 셰프샤우엔
  ('v38', true ),  -- 인도
  ('v39', false),  -- 네팔 포카라
  ('v40', false),  -- 네팔 카트만두
  ('v41', true ),  -- 방글라데시 해안 (콕스바자르)
  ('v42', true ),  -- 베트남 리엔선
  ('v43', false),  -- 마카오
  ('v44', true ),  -- 대만 타이난 외곽
  ('v45', true ),  -- 필리핀 풀라그산
  ('v46', false),  -- 중국 상하이
  ('v47', true ),  -- 일본 나고야 (아오나미)
  ('v48', true ),  -- 일본 도쿄 마루노우치
  ('v49', false),  -- 페루 산타클라라 데 야리나코차
  ('v50', false),  -- 케냐 마사이마라
  ('v51', false),  -- 파푸아뉴기니 마운트하겐
  ('v52', false),  -- 호주 퀸즐랜드 (케언스)
  ('v53', true ),  -- 칠레
  ('v54', false),  -- 아르헨티나 살타
  ('v55', false),  -- 아르헨티나 부에노스아이레스
  ('v56', false),  -- 남아공 무이젠버그
  ('v57', false),  -- 호주 시드니
  ('v58', false),  -- 뉴질랜드 퀸스타운
  ('v59', false),  -- 아르헨티나 파타고니아
  ('v60', false)   -- 남극 (킹조지섬)
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
