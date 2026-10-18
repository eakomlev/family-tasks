export const COLORS = ['#ff5d73', '#ffb020', '#2ecc71', '#3ea6ff', '#a66bff', '#ff7ac6', '#ffd93d']

export interface Particle {
  x: number
  y: number
  // скорость, пикселей в секунду
  vx: number
  vy: number
  size: number
  rotation: number
  // скорость вращения, радиан в секунду
  spin: number
  color: string
  shape: 'rect' | 'circle'
  // сколько секунд частица уже живёт
  age: number
  // сколько секунд живёт всего
  ttl: number
}

export const GRAVITY = 1400
// сопротивление воздуха: доля скорости, остающаяся через секунду
const DRAG = 0.5

export const FADE_SECONDS = 0.8

const between = (random: () => number, min: number, max: number) => min + random() * (max - min)

// Два залпа снизу по углам навстречу друг другу и «дождь» сверху.
export function createBurst(width: number, height: number, count = 160, random: () => number = Math.random): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    const kind = i % 4 // 0 и 1: пушки слева и справа, 2 и 3: сверху
    const cannon = kind < 2
    const fromLeft = kind === 0
    // угол от вертикали: пушки бьют вверх и чуть к центру
    const tilt = between(random, 0.15, 0.7) * (fromLeft ? 1 : -1)
    const speed = between(random, 900, 1700) * Math.min(1, height / 800 + 0.4)
    particles.push({
      x: cannon ? (fromLeft ? 0 : width) : random() * width,
      y: cannon ? height : -20 - random() * height * 0.3,
      vx: cannon ? Math.sin(tilt) * speed : between(random, -120, 120),
      vy: cannon ? -Math.cos(tilt) * speed : between(random, 100, 380),
      size: between(random, 6, 12),
      rotation: random() * Math.PI * 2,
      spin: between(random, -9, 9),
      color: COLORS[Math.floor(random() * COLORS.length)],
      shape: random() < 0.25 ? 'circle' : 'rect',
      age: 0,
      ttl: between(random, 2.8, 4.6),
    })
  }
  return particles
}

// Сдвигает частицу на dt секунд.
export function stepParticle(p: Particle, dt: number): void {
  p.vx *= Math.pow(DRAG, dt)
  p.vy = p.vy * Math.pow(DRAG, dt) + GRAVITY * dt
  p.x += p.vx * dt
  p.y += p.vy * dt
  p.rotation += p.spin * dt
  p.age += dt
}

export const isAlive = (p: Particle) => p.age < p.ttl

// Прозрачность: полная, а в последние FADE_SECONDS частица плавно гаснет.
export const opacityOf = (p: Particle) => Math.max(0, Math.min(1, (p.ttl - p.age) / FADE_SECONDS))

// Заранее рассчитанная траектория частицы: положение, поворот и прозрачность через равные промежутки. Так вся анимация это одно движение
// времени (нативный драйвер), а не сотни обновлений состояния на каждом кадре.
export interface Trajectory {
  color: string
  shape: Particle['shape']
  size: number
  xs: number[]
  ys: number[]
  rotations: number[]
  opacities: number[]
}

export const SAMPLE_SECONDS = 0.1
// дольше этого частицы не живут (ttl не больше 4.6 с), запас на последний кадр
export const TOTAL_SECONDS = 4.7

export function buildTrajectories(width: number, height: number, count = 90, random: () => number = Math.random): Trajectory[] {
  const steps = Math.round(TOTAL_SECONDS / SAMPLE_SECONDS)
  return createBurst(width, height, count, random).map((p) => {
    const xs = [p.x]
    const ys = [p.y]
    const rotations = [p.rotation]
    const opacities = [opacityOf(p)]
    for (let i = 0; i < steps; i++) {
      stepParticle(p, SAMPLE_SECONDS)
      xs.push(p.x)
      ys.push(p.y)
      rotations.push(p.rotation)
      opacities.push(isAlive(p) ? opacityOf(p) : 0)
    }
    return { color: p.color, shape: p.shape, size: p.size, xs, ys, rotations, opacities }
  })
}
