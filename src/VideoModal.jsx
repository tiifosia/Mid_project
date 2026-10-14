import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

const percent = (n, total) => (total ? Math.round((n / total) * 100) : 0)

const CHOICES = [
  ['real', 'REAL', 'text-text-primary'],
  ['ai', 'AI GENERATED', 'text-accent'],
]

// 영상 폭 — 투표 상자의 높이를 영상 높이(폭 × 9/16)에 맞춰 위아래 선을 맞춘다
const VIDEO_W = 'min(56vw, calc((100vh - 12rem) * 16 / 9))'

export default function VideoModal({ id, row, voted, onClose, onVote }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const real = row?.real_votes ?? 0
  const ai = row?.ai_votes ?? 0
  const total = real + ai

  return (
    <div
      className="modal-in absolute inset-0 z-[2000] flex flex-col items-center gap-4 overflow-y-auto p-4 md:justify-center md:gap-6 md:p-8"
      style={{ '--vw': VIDEO_W }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="hud h-10 rounded-full px-6 text-[11px] tracking-[0.28em] text-text-secondary transition-colors hover:text-text-primary"
      >
        MAP으로 이동
      </button>

      {/* 넓은 화면: 영상 | 투표 상자 (위아래 선 맞춤) / 휴대폰: 위아래로 쌓는다 */}
      <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:gap-6" onClick={(e) => e.stopPropagation()}>
        <div className="glass aspect-video w-full shrink-0 overflow-hidden rounded-3xl bg-black md:w-[var(--vw)]">
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

        <div className="glass flex h-[60dvh] w-full shrink-0 flex-col gap-4 overflow-hidden rounded-3xl p-5 md:h-[calc(var(--vw)*9/16)] md:w-80">
          <div className="space-y-2.5 text-text-primary">
            <Bar label="REAL" count={real} pct={percent(real, total)} />
            <Bar label="AI GENERATED" count={ai} pct={percent(ai, total)} />
            <p className="text-right text-xs text-text-secondary">총 {total}표</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {CHOICES.map(([choice, label, color]) => (
              <button
                key={choice}
                type="button"
                disabled={!!voted}
                onClick={() => onVote(choice)}
                className={`glass rounded-full py-3 text-xs font-semibold tracking-wider transition-opacity ${color} ${
                  voted === choice ? 'ring-1 ring-current' : voted ? 'opacity-35' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Comments videoId={id} />
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

const time = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

// 영상마다 따로 남기는 익명 댓글 — 새 댓글은 실시간으로 모두에게 붙는다
function Comments({ videoId }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listEl = useRef(null)

  useEffect(() => {
    setComments([])
    supabase
      .from('comments')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at')
      .limit(200)
      .then(({ data }) => data && setComments(data))
    const channel = supabase
      .channel(`comments:${videoId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `video_id=eq.${videoId}` },
        ({ new: c }) => setComments((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, c])),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [videoId])

  // 새 댓글이 붙으면 맨 아래로
  useEffect(() => {
    listEl.current?.scrollTo({ top: listEl.current.scrollHeight, behavior: 'smooth' })
  }, [comments.length])

  const submit = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    const { data, error } = await supabase.rpc('add_comment', { video_id: videoId, body })
    setSending(false)
    if (error) return alert(`댓글을 남기지 못했습니다.\n(${error.message})`)
    setText('')
    if (data?.id) setComments((cs) => (cs.some((x) => x.id === data.id) ? cs : [...cs, data]))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-text-primary/10 pt-4">
      <p className="mb-2 text-[11px] tracking-[0.28em] text-text-secondary">
        COMMENTS <span className="text-text-primary">{comments.length}</span>
      </p>
      <ul ref={listEl} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
        {comments.length === 0 && <li className="text-xs text-text-secondary">첫 댓글을 남겨 보세요.</li>}
        {comments.map((c) => (
          <li key={c.id} className="break-words leading-snug text-text-primary">
            {c.body}
            <span className="ml-2 text-[10px] text-text-secondary">{time(c.created_at)}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-3 flex items-center gap-2 rounded-full bg-text-primary/5 py-1 pl-4 pr-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="익명으로 댓글 남기기"
          className="min-w-0 flex-1 bg-transparent text-sm text-text-primary caret-accent outline-none placeholder:text-text-secondary/60"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="rounded-full px-3 py-1.5 text-[11px] tracking-[0.2em] text-accent transition-opacity disabled:opacity-30"
        >
          등록
        </button>
      </form>
    </div>
  )
}
