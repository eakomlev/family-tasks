import { describe, expect, it } from 'vitest'
import { buildTrajectories, COLORS, createBurst, FADE_SECONDS, isAlive, opacityOf, SAMPLE_SECONDS, stepParticle, TOTAL_SECONDS } from '@/features/tasks/confettiPhysics'

// предсказуемый «случайный» источник
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

describe('createBurst', () => {
  const particles = createBurst(400, 800, 160, seeded())

  it('создаёт заказанное число частиц нужных цветов', () => {
    expect(particles).toHaveLength(160)
    expect(particles.every((p) => COLORS.includes(p.color))).toBe(true)
  })

  it('залпы стартуют снизу по углам и летят вверх, к центру', () => {
    const left = particles.filter((p) => p.x === 0 && p.y === 800)
    const right = particles.filter((p) => p.x === 400 && p.y === 800)
    expect(left.length).toBeGreaterThan(0)
    expect(right.length).toBeGreaterThan(0)
    expect(left.every((p) => p.vy < 0 && p.vx > 0)).toBe(true)
    expect(right.every((p) => p.vy < 0 && p.vx < 0)).toBe(true)
  })

  it('дождь начинается выше экрана и падает вниз', () => {
    const rain = particles.filter((p) => p.y < 0)
    expect(rain.length).toBeGreaterThan(0)
    expect(rain.every((p) => p.vy > 0 && p.x >= 0 && p.x <= 400)).toBe(true)
  })

  it('у всех положительные размер и время жизни', () => {
    expect(particles.every((p) => p.size > 0 && p.ttl > 0 && p.age === 0)).toBe(true)
  })
})

describe('stepParticle', () => {
  const base = () => ({ ...createBurst(400, 800, 1, seeded(7))[0] })

  it('гравитация тянет вниз: вертикальная скорость растёт', () => {
    const p = { ...base(), vx: 0, vy: 0 }
    stepParticle(p, 0.1)
    expect(p.vy).toBeGreaterThan(0)
    expect(p.y).toBeGreaterThan(base().y - 1000)
  })

  it('частица стареет и вращается', () => {
    const p = base()
    const rotation = p.rotation
    stepParticle(p, 0.5)
    expect(p.age).toBeCloseTo(0.5)
    expect(p.rotation).not.toBe(rotation)
  })

  it('скорость затухает от сопротивления воздуха', () => {
    const p = { ...base(), vx: 1000, vy: 0 }
    stepParticle(p, 0.5)
    expect(p.vx).toBeLessThan(1000)
    expect(p.vx).toBeGreaterThan(0)
  })
})

describe('жизнь частицы', () => {
  const p = { ...createBurst(100, 100, 1, seeded(3))[0], age: 0, ttl: 3 }

  it('живёт до конца срока', () => {
    expect(isAlive({ ...p, age: 2.99 })).toBe(true)
    expect(isAlive({ ...p, age: 3 })).toBe(false)
  })

  it('плавно гаснет в последние секунды', () => {
    expect(opacityOf({ ...p, age: 0 })).toBe(1)
    expect(opacityOf({ ...p, age: 3 - FADE_SECONDS / 2 })).toBeCloseTo(0.5)
    expect(opacityOf({ ...p, age: 3 })).toBe(0)
    expect(opacityOf({ ...p, age: 5 })).toBe(0)
  })
})

describe('buildTrajectories', () => {
  const trajectories = buildTrajectories(400, 800, 40, seeded(3))

  it('траектория на каждую частицу, все с одинаковым числом отсчётов', () => {
    expect(trajectories).toHaveLength(40)
    const samples = trajectories[0].xs.length
    expect(samples).toBe(Math.round(TOTAL_SECONDS / SAMPLE_SECONDS) + 1)
    expect(trajectories.every((t) => [t.ys, t.rotations, t.opacities].every((list) => list.length === samples))).toBe(true)
  })

  it('в начале частицы видны, к концу погасли', () => {
    expect(trajectories.every((t) => t.opacities[0] > 0)).toBe(true)
    expect(trajectories.every((t) => t.opacities[t.opacities.length - 1] === 0)).toBe(true)
  })

  it('прозрачность всегда от 0 до 1', () => {
    expect(trajectories.flatMap((t) => t.opacities).every((o) => o >= 0 && o <= 1)).toBe(true)
  })
})
