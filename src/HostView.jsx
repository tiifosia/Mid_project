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
const REVEAL_SECONDS = 1.4 // 오프닝 뒤 세계 전체로 물러나며 선명해지는 시간

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

  const close = () => {
    setShowModal(false)
    setSelected(null)
    mapRef.current.flyToBounds(WORLD, { ...FIT, duration: FLY_SECONDS, easeLinearity: 0.2 })
  }

  // 호스트 판정: 투표 마감 + 판정 저장, 팝업은 바로 닫는다
  const decide = async (id, choice) => {
    close()
    const { error } = await supabase.rpc('decide', { video_id: id, choice })
    if (error) return alert(`판정 저장에 실패했습니다.\n(${error.message})`)
    setRows((rs) => ({ ...rs, [id]: { ...rs[id], verdict: choice, status: 'closed' } }))
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

  // 전체 영상 상태 로드 + 실시간 구독 (투표 수, 판정)
  useEffect(() => {
    supabase
      .from('videos')
      .select('*')
      .then(({ data }) => data && setRows(Object.fromEntries(data.map((r) => [r.id, r]))))
    const channel = supabase
      .channel('videos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'videos' }, ({ new: row }) =>
        setRows((rs) => ({ ...rs, [row.id]: row })),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // 판정에 따라 마커 색: 미판정 #8d8d8d, REAL #F5F5F5, AI #C3BDFF
  useEffect(() => {
    VIDEOS.forEach(({ id }) => {
      const el = markerEls.current[id]
      if (el) el.dataset.verdict = rows[id]?.verdict ?? ''
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
          className={`absolute transition-[filter] ${selected || !revealed ? 'pointer-events-none blur-xl' : ''} ${revealed ? 'is-revealed' : ''}`}
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

        {/* 번호로 지점 이동 */}
        <form
          onSubmit={submitNumber}
          className={`glass absolute left-1/2 top-6 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-full px-5 py-2 transition-opacity duration-500 ${selected || !revealed || revealing ? 'pointer-events-none opacity-0' : ''}`}
        >
          <span className="text-xs tracking-[0.3em] text-text-secondary">NO.</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="w-14 bg-transparent text-center text-text-primary outline-none"
          />
        </form>

        {/* 모달을 열기 전에 영상을 미리 받아 두어 즉시 재생되게 한다 */}
        <div hidden>
          {VIDEOS.map(({ id }) => (
            <video key={id} src={`${import.meta.env.BASE_URL}videos/${id}.mp4`} preload="auto" muted />
          ))}
        </div>
        {showModal && selected && (
          <VideoModal id={selected} row={rows[selected]} onClose={close} onDecide={(choice) => decide(selected, choice)} />
        )}
      </div>
      {intro && <div ref={introEl} className="relative z-10" />}
    </>
  )
}
