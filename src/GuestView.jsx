import { useState } from 'react'
import { supabase } from './supabase.js'

const videoId = new URLSearchParams(window.location.search).get('id')
const storageKey = `voted_${videoId}`

const hasVoted = () => {
  try {
    return localStorage.getItem(storageKey) !== null
  } catch {
    return false
  }
}

function VoteButton({ label, onVote }) {
  const [ripples, setRipples] = useState([])

  const spawnRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2.5
    setRipples((rs) => [
      ...rs,
      { id: performance.now(), x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size },
    ])
  }

  return (
    <div className="h-1/2 p-3">
      <button
        onPointerDown={spawnRipple}
        onClick={onVote}
        className="glass relative h-full w-full select-none overflow-hidden rounded-[2rem] text-2xl font-bold tracking-widest text-text-primary [-webkit-tap-highlight-color:transparent]"
      >
        {ripples.map((r) => (
          <span
            key={r.id}
            className="ripple"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
            onAnimationEnd={() => setRipples((rs) => rs.filter((x) => x.id !== r.id))}
          />
        ))}
        <span className="relative">{label}</span>
      </button>
    </div>
  )
}

export default function GuestView() {
  const [voted, setVoted] = useState(hasVoted)
  const [sending, setSending] = useState(false)

  const vote = async (choice) => {
    if (sending || voted) return
    setSending(true)
    const { error } = await supabase.rpc('vote', { video_id: videoId, choice })
    setSending(false)
    if (error) return alert('투표에 실패했습니다. 다시 시도해 주세요.')
    try {
      localStorage.setItem(storageKey, choice)
    } catch {}
    setVoted(true)
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-background">
      {/* 유리 질감이 비쳐 보이도록 하는 은은한 배경 빛 */}
      <div className="absolute -left-1/4 top-1/4 h-2/5 w-3/4 rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute -right-1/4 bottom-1/4 h-2/5 w-3/4 rounded-full bg-surface blur-3xl" />

      <div
        aria-hidden={voted}
        className={`absolute inset-0 flex flex-col transition-opacity duration-700 ${voted ? 'pointer-events-none opacity-0' : ''}`}
      >
        <VoteButton label="REAL" onVote={() => vote('real')} />
        <VoteButton label="AI GENERATED" onVote={() => vote('ai')} />
      </div>

      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center text-lg text-text-primary transition-opacity duration-700 delay-300 ${voted ? 'opacity-100' : 'opacity-0'}`}
      >
        투표 완료. 메인 스크린을 확인해 주세요.
      </div>
    </div>
  )
}
