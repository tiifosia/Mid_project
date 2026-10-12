import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './supabase.js'

const percent = (n, total) => (total ? Math.round((n / total) * 100) : 0)

export default function VideoModal({ id, onClose }) {
  const [row, setRow] = useState(null)

  useEffect(() => {
    supabase.from('videos').select('*').eq('id', id).single().then(({ data }) => setRow(data))
    const channel = supabase
      .channel(`video-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'videos', filter: `id=eq.${id}` },
        (payload) => setRow(payload.new),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeVoting = () => supabase.rpc('close_voting', { video_id: id })

  const total = row ? row.real_votes + row.ai_votes : 0
  const realPct = row ? percent(row.real_votes, total) : 0
  const aiPct = row ? percent(row.ai_votes, total) : 0
  const closed = row?.status === 'closed'
  const [answerMain, answerSub] = row?.is_ai ? ['AI', 'GENERATED'] : ['REAL', '']

  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center p-6" onClick={onClose}>
      {closed && <div className="light-burst" />}

      {/* 비디오가 화면 정중앙, 패널은 그 우측에 붙는다 */}
      <div
        className="group relative w-[min(52vw,calc(80vh*16/9))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass aspect-video overflow-hidden rounded-3xl bg-black">
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

        <div
          className={`glass absolute left-full top-1/2 ml-6 flex -translate-y-1/2 flex-col gap-6 rounded-3xl p-6 ${closed ? 'glass-lit' : ''}`}
          style={{ width: 'min(18rem, calc(24vw - 2.5rem))' }}
        >
          {closed ? (
            <div className="answer-reveal flex flex-col items-center text-center">
              <p className="mb-2 text-sm tracking-widest text-text-secondary">ANSWER</p>
              <p className="glow-text text-6xl font-extrabold leading-none text-accent">{answerMain}</p>
              {answerSub && <p className="glow-text mt-2 text-xl font-bold tracking-[0.3em] text-accent">{answerSub}</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-text-primary p-3">
                <QRCodeSVG value={`${window.location.origin}${import.meta.env.BASE_URL}vote/?id=${id}`} size={128} />
              </div>
              <p className="text-sm text-text-secondary">스캔하고 투표하세요</p>
            </div>
          )}

          <div className="space-y-3 text-text-primary">
            <Bar label="REAL" count={row?.real_votes ?? 0} pct={realPct} />
            <Bar label="AI GENERATED" count={row?.ai_votes ?? 0} pct={aiPct} />
            <p className="text-right text-xs text-text-secondary">총 {total}표</p>
          </div>

          {!closed && (
            <button
              onClick={closeVoting}
              className="glass rounded-full py-3 text-sm font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100"
            >
              투표 마감 및 결과 공개
            </button>
          )}
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
