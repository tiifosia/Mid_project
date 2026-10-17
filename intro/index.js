// 메인 타이틀 + 포트폴리오 About(진행 방식 네 단계)을 띄우는 오프닝 — 하단 NEXT 로 한 단계씩.
// 호스트 화면에서만 동적으로 불러온다(포트폴리오 CSS 가 전역 규칙이라 게스트 화면에 섞이지 않게).
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './style.css'
import markup from './markup.html?raw'

const NAV_ROOM = 104 // 하단 진행 캡슐 자리 (style.css 의 --nav-room 과 같게)
const LEAVE_MS = 1000 // 오프닝이 흐려지며 걷히는 시간 (style.css 의 .pf-leaving 과 같게)

// onStart: 시작하기를 누른 순간(지도 펼치기 시작) / onDone: 오프닝이 다 걷힌 뒤(제거)
export async function startIntro(container, { onStart, onDone }) {
  // 새로고침하면 브라우저가 이전 스크롤 위치(예: 스토리 중간)로 되돌려 놓아, 첫 연출이 엉뚱한 자리에서
  // 거꾸로 감기며 시작했다. 오프닝은 항상 맨 위에서 시작한다
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)
  container.innerHTML = markup.replace('%SIGNATURE%', `${import.meta.env.BASE_URL}signature.mp4`)

  // 포트폴리오 스크립트는 CDN 으로 받은 전역 gsap · ScrollTrigger 를 쓴다
  window.gsap = gsap
  window.ScrollTrigger = ScrollTrigger
  await import('./world-dots.js')
  await import('./main.js')

  // 직접 스크롤은 잠그고 하단 NEXT 로만 한 단계씩 진행한다
  window.pageScroll?.lock(true)

  const nav = container.querySelector('.pf-nav')
  const now = nav.querySelector('.pf-nav__now')
  const total = nav.querySelector('.pf-nav__total')
  const label = nav.querySelector('.pf-nav__label')
  const next = nav.querySelector('.pf-nav__next')
  const prev = nav.querySelector('.pf-nav__prev')
  const pad = (n) => String(n).padStart(2, '0')

  // 멈출 자리(스크롤 위치) — 레이아웃이 바뀌어도 맞도록 누를 때마다 ScrollTrigger 에서 다시 계산한다
  const stops = () => {
    const vh = window.innerHeight
    const max = ScrollTrigger.maxScroll(window)
    const all = ScrollTrigger.getAll()
    const story = all.find((t) => t.pin === container.querySelector('.story'))
    // 1. 메인 타이틀 (맨 위)
    const ys = [0]
    // 2~5. 스토리 네 단계가 각각 끝난 자리 (고정 구간에서 화면 높이 1 = 한 단계).
    //      1~3단계 문장은 다음 단계로 넘어가기 직전(0.88)부터 흐려지므로 그 앞(0.87)에서 멈춘다. 4단계는 고정이 끝나는 자리(1.0).
    if (story) for (let k = 0; k < 4; k++) ys.push(story.start + (k + (k < 3 ? 0.87 : 1)) * vh)
    return ys.map((y) => Math.round(Math.min(Math.max(y, 0), max)))
  }

  const step = () => Math.max(1, stops().filter((y) => y <= window.scrollY + 4).length) // 1부터
  const render = () => {
    const ys = stops()
    const i = step()
    now.textContent = pad(i)
    total.textContent = pad(ys.length)
    const last = i >= ys.length
    nav.classList.toggle('is-last', last)
    label.textContent = last ? '시작하기' : 'NEXT'
    prev.disabled = i <= 1
  }
  render()

  // 다음(이전) 자리까지 부드럽게 움직인다 — 스크롤 연동 연출(타이핑 · 점 지도)은 그 사이 그대로(거꾸로) 재생된다
  let moving = false
  const moveTo = (to) => {
    moving = true
    const p = { y: window.scrollY }
    const dist = Math.abs(to - p.y) / window.innerHeight
    gsap.to(p, {
      y: to,
      duration: Math.min(3.4, Math.max(1.2, dist * 0.9)),
      ease: 'power1.inOut',
      onUpdate: () => {
        window.scrollTo(0, p.y)
        ScrollTrigger.update()
      },
      onComplete: () => {
        moving = false
        render()
      },
    })
  }

  // 시작하기 — 오프닝이 흐려지며 걷히는 동안 뒤에 고정된 지도가 줌아웃하며 펼쳐진다.
  // 다 걷힌 뒤 스크롤 연출을 해제하고 오프닝을 지운다(그때 화면에는 지도만 보이므로 튀지 않는다).
  let leaving = false
  const leave = () => {
    leaving = true
    window.removeEventListener('keydown', onKey)
    container.classList.add('pf-leaving')
    onStart()
    setTimeout(() => {
      ScrollTrigger.getAll().forEach((t) => t.kill())
      document.querySelector('.veil')?.remove()
      window.pageScroll?.lock(false)
      onDone()
    }, LEAVE_MS)
  }

  const forward = () => {
    if (moving || leaving) return
    const to = stops().find((y) => y > window.scrollY + 4)
    if (to === undefined) leave()
    else moveTo(to)
  }
  const back = () => {
    if (moving || leaving) return
    const to = stops().filter((y) => y < window.scrollY - 4).pop()
    if (to !== undefined) moveTo(to)
  }
  next.addEventListener('click', forward)
  prev.addEventListener('click', back)
  // 키보드로도 진행 — 앞으로: Enter · Space · → · ↓ · PageDown / 뒤로: ← · ↑ · PageUp
  const onKey = (e) => {
    const fwd = /^(Enter| |ArrowRight|ArrowDown|PageDown)$/.test(e.key)
    const bwd = /^(ArrowLeft|ArrowUp|PageUp)$/.test(e.key)
    if (!fwd && !bwd) return
    e.preventDefault()
    if (e.repeat) return
    if (fwd) forward()
    else back()
  }
  window.addEventListener('keydown', onKey)
}
