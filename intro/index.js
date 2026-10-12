// 포트폴리오 Top ~ About 을 그대로 띄우는 스크롤 오프닝.
// 호스트 화면에서만 동적으로 불러온다(포트폴리오 CSS 가 전역 규칙이라 게스트 화면에 섞이지 않게).
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './style.css'
import markup from './markup.html?raw'

const LEAVE_MS = 1000 // 오프닝이 흐려지며 걷히는 시간 (style.css 의 .pf-leaving 과 같게)

// onStart: 시작하기를 누른 순간(지도 펼치기 시작) / onDone: 오프닝이 다 걷힌 뒤(제거)
export async function startIntro(container, { onStart, onDone }) {
  container.innerHTML = markup.replace('%SIGNATURE%', `${import.meta.env.BASE_URL}signature.mp4`)

  // 포트폴리오 스크립트는 CDN 으로 받은 전역 gsap · ScrollTrigger 를 쓴다
  window.gsap = gsap
  window.ScrollTrigger = ScrollTrigger
  await import('./world-dots.js')
  await import('./main.js')

  // 시작하기 — 오프닝이 흐려지며 걷히는 동안 뒤에 고정된 지도가 줌아웃하며 펼쳐진다.
  // 다 걷힌 뒤 스크롤 연출을 해제하고 오프닝을 지운다(그때 화면에는 지도만 보이므로 튀지 않는다).
  const start = container.querySelector('.pf-start')
  start.addEventListener('click', () => {
    start.disabled = true
    window.pageScroll?.lock(true)
    container.classList.add('pf-leaving')
    onStart()
    setTimeout(() => {
      ScrollTrigger.getAll().forEach((t) => t.kill())
      document.querySelector('.veil')?.remove()
      window.pageScroll?.lock(false)
      onDone()
    }, LEAVE_MS)
  })
}
