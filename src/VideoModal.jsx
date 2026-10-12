import { useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const percent = (n, total) => (total ? Math.round((n / total) * 100) : 0)

const VERDICTS = [
  ['real', 'REAL', 'text-text-primary'],
  ['ai', 'AI GENERATED', 'text-accent'],
]

export default function VideoModal({ id, row, onClose, onDecide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const real = row?.real_votes ?? 0
  const ai = row?.ai_votes ?? 0
  const total = real + ai
  const closed = row?.status === 'closed'

  return (
    <div className="modal-in absolute inset-0 z-[2000] flex items-center justify-center p-8" onClick={onClose}>
      <div className="group flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
        <div className="glass aspect-video w-[min(68vw,calc((100vh-6rem)*16/9))] overflow-hidden rounded-3xl bg-black">
          <video
            key={id}
            src={`${import.meta.env.BASE_URL}videos/${id}.mp4`}
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div className="glass flex w-72 shrink-0 flex-col gap-6 rounded-3xl p-6">
          <div className="flex flex-col items-center gap-3">
            <div className={`rounded-2xl bg-text-primary p-3 ${closed ? 'opacity-30' : ''}`}>
              <QRCodeSVG value={`${window.location.origin}${import.meta.env.BASE_URL}vote/?id=${id}`} size={128} />
            </div>
            <p className="text-sm text-text-secondary">{closed ? '투표가 마감되었습니다' : '스캔하고 투표하세요'}</p>
          </div>

          <div className="space-y-3 text-text-primary">
            <Bar label="REAL" count={real} pct={percent(real, total)} />
            <Bar label="AI GENERATED" count={ai} pct={percent(ai, total)} />
            <p className="text-right text-xs text-text-secondary">총 {total}표</p>
          </div>

          {/* 호스트 판정: 마우스를 올렸을 때만 보인다 */}
          <div className="grid grid-cols-2 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {VERDICTS.map(([choice, label, color]) => (
              <button
                key={choice}
                onClick={() => onDecide(choice)}
                className={`glass rounded-full py-3 text-xs font-semibold tracking-wider ${color} ${row?.verdict === choice ? 'ring-1 ring-current' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Bar({ label, count, pct }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span>
          {count}표 · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-text-secondary/30">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
