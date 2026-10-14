import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

const percent = (n, total) => (total ? Math.round((n / total) * 100) : 0)

const CHOICES = [
  ['real', 'REAL', 'text-text-primary'],
  ['ai', 'AI GENERATED', 'text-accent'],
]

// 투표 상자 폭 · 영상 폭 — 투표 상자의 높이를 영상 높이(폭 × 9/16)에 맞춰 위아래 선을 맞춘다.
// 화면을 꽉 채우되 투표 상자 · 간격 · 여백(4.5rem)이 들어갈 자리는 남긴다
const PANEL_W = 'clamp(20rem, 24vw, 26rem)'
const VIDEO_W = `min(64vw, calc(100vw - ${PANEL_W} - 4.5rem), calc((100vh - 10rem) * 16 / 9))`


export default function VideoModal({ id, row, voted, onClose, onVote, onUnvote }) {
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
      className="modal-in absolute inset-0 z-[2000] flex flex-col items-center gap-4 overflow-y-auto p-4 md:justify-center md:gap-5 md:p-6"
      style={{ '--vw': VIDEO_W, '--pw': PANEL_W }}
      onClick={onClose}
      // 오프닝의 부드러운 스크롤이 창 전체에서 휠을 가로채므로, 팝업 안의 휠은 거기까지 가지 않게 한다(댓글 목록이 직접 스크롤된다)
      onWheel={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        className="hud h-11 rounded-full px-7 text-xs tracking-[0.28em] text-text-secondary transition-colors hover:text-text-primary"
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

        {/* 키가 낮은 창(노트북 브라우저 등, 높이 680px 이하)에서는 상자 안을 촘촘하게 해 댓글 자리를 남긴다 */}
        <div className="glass flex h-[60dvh] w-full shrink-0 flex-col gap-5 overflow-hidden rounded-3xl p-6 md:h-[calc(var(--vw)*9/16)] md:w-[var(--pw)] [@media(max-height:680px)]:gap-3 [@media(max-height:680px)]:p-5">
          <div className="space-y-3 text-text-primary [@media(max-height:680px)]:space-y-2">
            <Bar label="REAL" count={real} pct={percent(real, total)} />
            <Bar label="AI GENERATED" count={ai} pct={percent(ai, total)} />
            <p className="text-right text-sm text-text-secondary [@media(max-height:680px)]:hidden">총 {total}표</p>
          </div>

          <div className="flex gap-2">
            {CHOICES.map(([choice, label, color]) => (
              <button
                key={choice}
                type="button"
                disabled={!!voted}
                onClick={() => onVote(choice)}
                className={`glass h-12 flex-1 whitespace-nowrap rounded-full text-xs font-semibold xl:text-[13px] [@media(max-height:680px)]:h-11 tracking-wider transition-opacity ${color} ${
                  voted === choice ? 'ring-1 ring-current' : voted ? 'opacity-35' : ''
                }`}
              >
                {label}
              </button>
            ))}
            {/* 내 투표만 취소 — 투표하기 전에는 흐리게 잠겨 있다 */}
            <button
              type="button"
              disabled={!voted}
              onClick={onUnvote}
              aria-label="내 투표 취소"
              title="내 투표 취소"
              className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl [@media(max-height:680px)]:h-11 [@media(max-height:680px)]:w-11 text-text-secondary transition-colors hover:text-text-primary disabled:opacity-30 disabled:hover:text-text-secondary"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
            </button>
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
      <div className="mb-1.5 flex justify-between text-[15px]">
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
    <div className="flex min-h-0 flex-1 flex-col border-t border-text-primary/10 pt-4 [@media(max-height:680px)]:pt-3">
      <p className="mb-2.5 text-xs tracking-[0.28em] text-text-secondary [@media(max-height:680px)]:mb-1.5">
        COMMENTS <span className="text-text-primary">{comments.length}</span>
      </p>
      <ul ref={listEl} className="comments min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-2 text-[15px]">
        {comments.length === 0 && <li className="text-xs text-text-secondary">첫 댓글을 남겨 보세요.</li>}
        {comments.map((c) => (
          <li key={c.id} className="break-words leading-snug text-text-primary">
            {c.body}
            <span className="ml-2 text-[11px] text-text-secondary">{time(c.created_at)}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-3 flex h-12 items-center [@media(max-height:680px)]:mt-2 [@media(max-height:680px)]:h-11 gap-2 rounded-full bg-text-primary/5 pl-5 pr-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="익명으로 댓글 남기기"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-text-primary caret-accent outline-none placeholder:text-text-secondary/60"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="rounded-full px-4 py-2 text-xs tracking-[0.2em] text-accent transition-opacity disabled:opacity-30"
        >
          등록
        </button>
      </form>
    </div>
  )
}
