import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { supabase } from './supabase.js'
import { VIDEOS } from './videos.js'
import VideoModal from './VideoModal.jsx'
import { addWorldLayers } from './worldLayers.js'

const WORLD = [[-56, -168], [78, 190]] // 남극을 뺀 세계 전체
// 지도를 화면보다 사방 BLEED 만큼 크게 깔아, 블러가 화면 가장자리에서도 바깥 내용까지 섞어 고르게 흐려지게 한다
const BLEED = 64
const FIT = { padding: [BLEED, BLEED] }
const FLY_SECONDS = 0.6
const RESET_SECONDS = 1.0
const REFRESH_MS = 5000 // 투표 수를 실시간과 별도로 다시 불러오는 간격 // Reset Zoom · MAP으로 이동: 세계 전체로 부드럽게 물러난다
const REVEAL_SECONDS = 1.4 // 오프닝 뒤 세계 전체로 물러나며 선명해지는 시간

// 이 기기에서 이미 투표한 선택 ('real' | 'ai' | null)
const votedChoice = (id) => {
  try {
    return localStorage.getItem(`voted_${id}`)
  } catch {
    return null
  }
}

// 이 기기에서 투표한 영상 전부 — 나의 정답률 계산용 [{ video_id, choice }]
const myVotes = () =>
  VIDEOS.map(({ id }) => ({ video_id: id, choice: votedChoice(id) })).filter((v) => v.choice)

// 방금 투표한 시각 — 투표 직전에 보낸 조회가 늦게 도착해 0표로 보여도 내 기록을 지우지 않게
const justVoted = {}
const FRESH_MS = 20000

// 서버에서 표가 0인 영상은 리셋된 것이다(내 표가 들어가 있다면 0일 수 없다).
// 그 영상의 이 기기 투표 기록을 지워 다시 투표할 수 있게 한다
const forgetResetVotes = (data) =>
  data.forEach((r) => {
    if (r.real_votes + r.ai_votes > 0 || Date.now() - (justVoted[r.id] ?? 0) < FRESH_MS) return
    try {
      localStorage.removeItem(`voted_${r.id}`)
    } catch {}
  })

export default function HostView() {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markerEls = useRef({})
  const [rows, setRows] = useState({})
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [number, setNumber] = useState('')
  const introEl = useRef(null)
  const [intro, setIntro] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [revealing, setRevealing] = useState(false)
  // 전체 · 나의 정답률 — 정답은 서버에만 있고, 서버가 맞힌 개수만 돌려준다
  const [accuracy, setAccuracy] = useState(null)
  const rateActive = revealed && !revealing && !selected
  const loadAccuracy = () =>
    supabase.rpc('accuracy', { my_votes: myVotes() }).then(({ data }) => data && setAccuracy(data))

  // 오프닝이 걷히면: 가까이 당겨져 흐린 지도가 세계 전체로 물러나며 선명해지고 마커가 떠오른다
  const reveal = () => {
    setRevealed(true)
    setRevealing(true)
    mapRef.current.flyToBounds(WORLD, { ...FIT, duration: REVEAL_SECONDS, easeLinearity: 0.2 })
    setTimeout(() => setRevealing(false), REVEAL_SECONDS * 1000)
  }

  // 지점으로 슈욱 줌인(+ 블러) → 도착하면 영상 모달
  const open = (id) => {
    const video = VIDEOS.find((v) => v.id === id)
    setSelected(id)
    mapRef.current.flyTo(video.position, 5, { duration: FLY_SECONDS, easeLinearity: 0.2 })
    setTimeout(() => setShowModal(true), FLY_SECONDS * 800)
  }

  // 팝업을 닫고 세계 전체(처음 크기)로 돌아간다
  const close = () => {
    setShowModal(false)
    setSelected(null)
    mapRef.current.flyToBounds(WORLD, { ...FIT, duration: FLY_SECONDS, easeLinearity: 0.2 })
  }

  // Reset Zoom: 확대 · 이동한 지도를 처음 크기로 자연스럽게 되돌린다
  const resetZoom = () => mapRef.current.flyToBounds(WORLD, { ...FIT, duration: RESET_SECONDS, easeLinearity: 0.2 })

  // 접속자 각자의 투표 — 이 기기에서 영상당 1표, 번복 불가. 숫자는 실시간 구독으로 모두에게 반영된다.
  // 성공하면 true (팝업이 결과 화면으로 넘어간다)
  const vote = async (id, choice) => {
    if (votedChoice(id)) return false
    const { error } = await supabase.rpc('vote', { video_id: id, choice })
    if (error) {
      alert(`투표에 실패했습니다. 다시 시도해 주세요.\n(${error.message})`)
      return false
    }
    justVoted[id] = Date.now()
    try {
      localStorage.setItem(`voted_${id}`, choice)
    } catch {}
    setRows((rs) => ({ ...rs, [id]: { ...rs[id], [`${choice}_votes`]: (rs[id]?.[`${choice}_votes`] ?? 0) + 1 } }))
    loadAccuracy()
    return true
  }

  useEffect(() => {
    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
      maxBoundsViscosity: 1,
    })
    mapRef.current = map
    map.fitBounds(WORLD, FIT)
    map.setMinZoom(map.getZoom())
    // 이동 허용 범위 = 세계 전체가 보이는 이 화면 그대로. 범위가 화면보다 좁거나 중심이 어긋나 있으면
    // 줌아웃이 끝난 뒤 Leaflet 이 지도를 범위 안으로 끌어다 놓아 옆으로 밀렸다(경도 6°, 약 24px).
    map.setMaxBounds(map.getBounds())
    map.setZoom(map.getZoom() + 1.5, { animate: false }) // 오프닝 동안은 가까이 당겨 둔다

    // 외부 타일 대신 Natural Earth 국가 경계를 직접 그린다: API 키 불필요, 오프라인 동작
    let alive = true
    addWorldLayers(map).then((layer) => !alive && layer.remove())

    VIDEOS.forEach(({ id, position }, i) => {
      const icon = L.divIcon({
        className: '',
        iconSize: [40, 40],
        html: `<div class="marker" style="--d:${(i * 137) % 800}ms"><span class="marker-ring"></span><span class="marker-ring"></span><span class="marker-core"></span><span class="marker-label">${i + 1}</span></div>`,
      })
      const marker = L.marker(position, { icon }).addTo(map).on('click', () => open(id))
      markerEls.current[id] = marker.getElement().querySelector('.marker')
    })
    return () => {
      alive = false
      map.remove()
    }
  }, [])

  // 스크롤 오프닝(포트폴리오 Top ~ About) → 시작하기를 누르면 지도가 펼쳐진다
  useEffect(() => {
    import('../intro/index.js').then(({ startIntro }) =>
      startIntro(introEl.current, { onStart: reveal, onDone: () => setIntro(false) }),
    )
  }, [])

  // 전체 영상 상태 로드 + 실시간 구독 (투표 수)
  // 여럿이 한꺼번에 투표하면 실시간 알림이 무료 한도에 걸려 늦거나 빠질 수 있어,
  // 화면을 보고 있는 동안 몇 초마다 다시 불러와 숫자를 맞춘다
  useEffect(() => {
    const load = () =>
      supabase
        .from('videos')
        .select('*')
        .then(({ data }) => {
          if (!data) return
          forgetResetVotes(data)
          setRows(Object.fromEntries(data.map((r) => [r.id, r])))
          loadAccuracy()
        })
    load()
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS)
    const channel = supabase
      .channel('videos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'videos' }, ({ new: row }) =>
        setRows((rs) => ({ ...rs, [row.id]: row })),
      )
      .subscribe()
    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [])

  // 실시간 다수결로 마커 색: 표가 없거나 동률 #8d8d8d, REAL #F5F5F5, AI #C3BDFF
  useEffect(() => {
    VIDEOS.forEach(({ id }) => {
      const el = markerEls.current[id]
      const real = rows[id]?.real_votes ?? 0
      const ai = rows[id]?.ai_votes ?? 0
      if (el) el.dataset.verdict = real > ai ? 'real' : ai > real ? 'ai' : ''
    })
  }, [rows])

  const submitNumber = (e) => {
    e.preventDefault()
    const video = VIDEOS[Number(number) - 1]
    setNumber('')
    if (video) open(video.id)
  }

  return (
    <>
      {/* 지도 화면은 고정해 두고, 오프닝이 그 위에서 스크롤된다 */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-background">
        <div
          className={`absolute transition-[filter] ${selected || !revealed ? 'is-blurred pointer-events-none blur-xl' : ''} ${revealed ? 'is-revealed' : ''}`}
          style={{
            inset: -BLEED,
            transitionDuration: `${revealing ? REVEAL_SECONDS : FLY_SECONDS}s`,
            // 줌인: 출발과 함께 빠르게 흐려짐 / 줌아웃: 날아가는 동안 흐림을 유지하다 도착하며 선명해짐
            transitionTimingFunction: selected ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.7, 0, 0.84, 0)',
          }}
        >
          <div ref={mapEl} className="h-full w-full bg-background" />
          {/* 가장자리를 배경색으로 가라앉히는 비네트 (지도 면 위, 마커 아래) — 보이는 화면 기준 */}
          <div
            className="pointer-events-none absolute z-[450] bg-[radial-gradient(ellipse_at_center,transparent_55%,#111111_100%)]"
            style={{ inset: BLEED }}
          />
        </div>

        {/* 상단 조작부: 하나의 캡슐 안에 Reset Zoom | NO. 입력 */}
        <div
          className={`hud absolute left-1/2 top-6 z-[1000] flex h-10 -translate-x-1/2 items-center rounded-full text-[11px] tracking-[0.28em] transition-opacity duration-500 ${selected || !revealed || revealing ? 'pointer-events-none opacity-0' : ''}`}
        >
          <button
            type="button"
            onClick={resetZoom}
            className="h-full whitespace-nowrap rounded-l-full pl-5 pr-4 uppercase sm:pl-6 sm:pr-5 text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:text-accent"
          >
            Reset Zoom
          </button>
          <span className="h-4 w-px bg-text-primary/10" />
          <form onSubmit={submitNumber} className="flex h-full items-center gap-3 pl-4 pr-5 sm:pl-5 sm:pr-6">
            <label htmlFor="video-no" className="text-text-secondary">
              NO.
            </label>
            <input
              id="video-no"
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Search video by number"
              // 안내 문구는 흐리게 깔려 있다가 입력하려고 누르면 사라진다
              className="w-36 text-ellipsis bg-transparent sm:w-48 text-[13px] tracking-[0.1em] text-text-primary caret-accent outline-none placeholder:text-[11px] placeholder:tracking-normal sm:placeholder:tracking-[0.12em] placeholder:text-text-secondary/45 placeholder:transition-opacity focus:placeholder:opacity-0"
            />
          </form>
        </div>

        {/* 하단 가운데: 전체 정답률 · 나의 정답률 — 지도가 보일 때마다 0%에서 차오른다 */}
        <div
          className={`absolute bottom-6 left-1/2 z-[1000] flex -translate-x-1/2 gap-3 transition-opacity duration-500 ${rateActive ? '' : 'pointer-events-none opacity-0'}`}
        >
          <Rate label="전체 정답률" correct={accuracy?.all_correct} total={accuracy?.all_total} bar="bg-text-primary" active={rateActive} />
          <Rate label="나의 정답률" correct={accuracy?.my_correct} total={accuracy?.my_total} bar="bg-accent" active={rateActive} />
        </div>

        {/* 고른 영상만 줌인하는 동안 미리 받기 시작해 팝업이 열리면 바로 재생되게 한다
            (영상이 100개라 전부 미리 받으면 접속자마다 수백 MB 를 받게 된다) */}
        {selected && (
          <video key={selected} hidden src={`${import.meta.env.BASE_URL}videos/${selected}.mp4`} preload="auto" muted />
        )}
        {showModal && selected && (
          <VideoModal
            id={selected}
            row={rows[selected]}
            voted={votedChoice(selected)}
            onClose={close}
            onVote={(choice) => vote(selected, choice)}
          />
        )}
      </div>
      {intro && <div ref={introEl} className="relative z-10" />}
    </>
  )
}

// 정답률 카드 — 퍼센트와 게이지. 지도가 처음 보일 때 0%에서 차오르고, 그 뒤로는 값이 바뀌면 그 값까지 굴러간다.
// 팝업이 열려 숨겨질 때는 값을 그대로 둔다(0으로 되돌리면 사라지는 동안 0%가 비쳐 보였다)
function Rate({ label, correct = 0, total = 0, bar, active }) {
  const pct = total ? Math.round((correct / total) * 100) : 0
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (active) setStarted(true)
  }, [active])
  const shown = useCountUp(started ? pct : 0)
  return (
    <div className="hud w-40 rounded-2xl px-5 pb-4 pt-3.5 sm:w-48">
      <div className="flex items-baseline justify-between gap-3">
        <span className="whitespace-nowrap text-[11px] tracking-[0.12em] text-text-secondary">{label}</span>
        <span className="text-lg font-semibold tabular-nums text-text-primary">{shown}%</span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-text-primary/10">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${shown}%` }} />
      </div>
    </div>
  )
}

function useCountUp(target, ms = 900) {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const begin = from.current
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms)
      const v = Math.round(begin + (target - begin) * (1 - (1 - t) ** 3))
      from.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}
