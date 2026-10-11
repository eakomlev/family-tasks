import { useEffect, useRef } from 'react'
import { createBurst, isAlive, opacityOf, stepParticle } from './utils'

// Конфетти на весь экран поверх страницы: залпы снизу и дождь сверху, затем всё стихает само.
// Не мешает кликам. При включённом «уменьшении движения» не рисуется.
export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const dpr = window.devicePixelRatio || 1
    const width = window.innerWidth
    const height = window.innerHeight
    el.width = width * dpr
    el.height = height * dpr
    ctx.scale(dpr, dpr)

    let particles = createBurst(width, height)
    let last = performance.now()
    let frame = 0

    const tick = (now: number) => {
      // после паузы вкладки не даём частицам прыгнуть на много секунд вперёд
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, width, height)

      particles = particles.filter(isAlive)
      for (const p of particles) {
        stepParticle(p, dt)
        ctx.save()
        ctx.globalAlpha = opacityOf(p)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        }
        ctx.restore()
      }

      if (particles.length > 0) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={canvas} aria-hidden style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 110 }} />
}
