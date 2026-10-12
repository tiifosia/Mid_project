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

  return (
    <div
      className="absolute inset-0 z-[2000] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="group flex items-stretch gap-6" onClick={(e) => e.stopPropagation()}>
        {/* 16:9 비디오 영역 (영상은 Step 4에서 삽입) */}
        <div className="glass aspect-video w-[min(64vw,calc(80vh*16/9))] overflow-hidden rounded-3xl" />

        {/* 리퀴드 글래스 패널 */}
        <div className="glass relative flex w-72 flex-col justify-between rounded-3xl p-6">
          <div className="flex flex-col items-center gap-4">
            {closed ? (
              <>
                <p className="text-sm text-text-secondary">정답</p>
                <p className="text-center text-3xl font-bold text-accent">
                  {row.is_ai ? 'AI GENERATED' : 'REAL'}
                </p>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-text-primary p-3">
                  <QRCodeSVG value={`${window.location.origin}/vote?id=${id}`} size={160} />
                </div>
                <p className="text-sm text-text-secondary">스캔하고 투표하세요</p>
              </>
            )}
          </div>

          <div className="space-y-3 text-text-primary">
            <Bar label="REAL" count={row?.real_votes ?? 0} pct={realPct} />
            <Bar label="AI GENERATED" count={row?.ai_votes ?? 0} pct={aiPct} />
            <p className="text-right text-xs text-text-secondary">총 {total}표</p>
          </div>

          {!closed && (
            <button
              onClick={closeVoting}
              className="glass mt-4 rounded-full py-3 text-sm font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100"
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
