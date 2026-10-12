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

  if (voted) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background px-8 text-center text-lg text-text-primary">
        투표 완료. 메인 스크린을 확인해 주세요.
      </div>
    )
  }

  return (
    <div className="flex h-dvh w-screen flex-col bg-background">
      <button
        onClick={() => vote('real')}
        className="h-1/2 w-full border-b border-text-secondary/30 bg-white/5 text-2xl font-bold tracking-widest text-text-primary backdrop-blur-xl"
      >
        REAL
      </button>
      <button
        onClick={() => vote('ai')}
        className="h-1/2 w-full bg-white/5 text-2xl font-bold tracking-widest text-text-primary backdrop-blur-xl"
      >
        AI GENERATED
      </button>
    </div>
  )
}
