import { useEffect, useRef, useState } from 'react'

const QUESTION = '우리는 무엇을 근거로 세계를 실제라고 믿는가?'
const TITLE_MS = 2800 // 제목을 보여 주는 시간
const TYPE_DELAY_MS = 500 // 제목이 물러난 뒤 타이핑 시작까지
const CHAR_MS = 75 // 한 글자당
const HOLD_MS = 1400 // 다 쓴 문장을 머금는 시간
const FADE_MS = 900 // 오프닝이 걷히는 시간

// 오프닝: 제목 → 질문 타이핑 → 지도. 클릭이나 아무 키로 건너뛴다.
export default function Intro({ onReveal, onDone }) {
  const [phase, setPhase] = useState('title') // title → question → out
  const [typed, setTyped] = useState(0)
  const finished = useRef(false)

  const finish = () => {
    if (finished.current) return
    finished.current = true
    setPhase('out')
    onReveal()
    setTimeout(onDone, FADE_MS)
  }

  useEffect(() => {
    const total = TITLE_MS + TYPE_DELAY_MS + QUESTION.length * CHAR_MS + HOLD_MS
    const timers = [setTimeout(() => setPhase('question'), TITLE_MS), setTimeout(finish, total)]
    window.addEventListener('keydown', finish)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('keydown', finish)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'question') return
    let timer
    const start = setTimeout(() => {
      timer = setInterval(() => setTyped((n) => Math.min(n + 1, QUESTION.length)), CHAR_MS)
    }, TYPE_DELAY_MS)
    return () => {
      clearTimeout(start)
      clearInterval(timer)
    }
  }, [phase])

  return (
    <div
      onClick={finish}
      className={`intro fixed inset-0 z-[3000] grid cursor-pointer place-items-center bg-background px-8 transition-opacity ${phase === 'out' ? 'pointer-events-none opacity-0' : ''}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className={`intro-title [grid-area:1/1] ${phase !== 'title' ? 'is-gone' : ''}`}>
        <h1 className="intro-line text-[clamp(44px,8.5vw,132px)] font-extrabold leading-[1.04] tracking-[-0.045em]">
          Generated World<span className="text-accent">,</span>
        </h1>
        <p
          className="intro-line text-[clamp(30px,5.7vw,89px)] font-light leading-[1.04] tracking-[-0.045em] text-text-secondary"
          style={{ animationDelay: '0.25s' }}
        >
          What remains of truth<span className="text-accent">?</span>
        </p>
      </div>

      {phase !== 'title' && (
        <p
          className="intro-question [grid-area:1/1] max-w-[12.5em] text-center text-[clamp(24px,4.2vw,60px)] font-light leading-[1.4] tracking-[-0.02em] [text-wrap:balance] [word-break:keep-all]"
          style={{ '--glow': typed / QUESTION.length }}
        >
          {[...QUESTION].map((ch, i) => (
            <span key={i} className={i < typed ? '' : 'text-transparent [text-shadow:none]'}>
              {ch}
              {/* 커서는 폭이 없는 자리에 세워 줄바꿈이 움직이지 않게 한다 */}
              {i === typed - 1 && <span className="intro-caret" />}
            </span>
          ))}
          {typed === 0 && <span className="intro-caret" />}
        </p>
      )}
    </div>
  )
}
