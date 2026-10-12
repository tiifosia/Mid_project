// 포트폴리오 Top ~ About 을 그대로 띄우는 스크롤 오프닝.
// 호스트 화면에서만 동적으로 불러온다(포트폴리오 CSS 가 전역 규칙이라 게스트 화면에 섞이지 않게).
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './style.css'
import markup from './markup.html?raw'

export async function startIntro(container, onDone) {
  container.innerHTML = markup.replace('%SIGNATURE%', `${import.meta.env.BASE_URL}signature.mp4`)

  // 포트폴리오 스크립트는 CDN 으로 받은 전역 gsap · ScrollTrigger 를 쓴다
  window.gsap = gsap
  window.ScrollTrigger = ScrollTrigger
  await import('./world-dots.js')
  await import('./main.js')

  // 마지막 빈 화면이 화면을 가득 채우면(= 끝까지 내림) 스크롤 연출을 걷고 지도로 넘어간다.
  // 그 순간 화면에는 뒤에 고정된 지도만 보이므로, 오프닝을 지워도 화면은 그대로다.
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio < 0.98) return
      io.disconnect()
      ScrollTrigger.getAll().forEach((t) => t.kill())
      document.querySelector('.veil')?.remove()
      onDone()
    },
    { threshold: [0.98] },
  )
  io.observe(container.querySelector('.pf-end'))
}
