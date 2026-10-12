import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { VIDEOS } from './videos.js'
import VideoModal from './VideoModal.jsx'
import { addWorldLayers } from './worldLayers.js'

export default function HostView() {
  const mapEl = useRef(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
      maxBounds: [[-80, -190], [85, 200]],
      maxBoundsViscosity: 1,
    })
    // 첫 화면에 남극을 뺀 세계 전체가 꽉 차게
    map.fitBounds([[-56, -168], [78, 190]])
    map.setMinZoom(map.getZoom())

    // 외부 타일 대신 Natural Earth 국가 경계를 직접 그린다: API 키 불필요, 오프라인 동작
    let alive = true
    addWorldLayers(map).then((layer) => !alive && layer.remove())

    VIDEOS.forEach(({ id, label, position }) => {
      const icon = L.divIcon({
        className: '',
        iconSize: [40, 40],
        html: `<div class="marker"><span class="marker-ring"></span><span class="marker-ring"></span><span class="marker-core"></span><span class="marker-label">${label}</span></div>`,
      })
      L.marker(position, { icon }).addTo(map).on('click', () => setSelected(id))
    })
    return () => {
      alive = false
      map.remove()
    }
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <div className={`relative h-full w-full transition-all duration-500 ${selected ? 'blur-2xl' : ''}`}>
        <div ref={mapEl} className="h-full w-full bg-background" />
        {/* 가장자리를 배경색으로 가라앉히는 비네트 (지도 면 위, 마커 아래) */}
        <div className="pointer-events-none absolute inset-0 z-[450] bg-[radial-gradient(ellipse_at_center,transparent_55%,#111111_100%)]" />
      </div>
      {/* 모달을 열기 전에 영상을 미리 받아 두어 즉시 재생되게 한다 */}
      <div hidden>
        {VIDEOS.map(({ id }) => (
          <video key={id} src={`${import.meta.env.BASE_URL}videos/${id}.mp4`} preload="auto" muted />
        ))}
      </div>
      {selected && <VideoModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
