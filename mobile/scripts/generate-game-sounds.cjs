// Генерирует звуки игр (assets/sounds/): move.wav (ход, глухой «тук» дерева), capture.wav (взятие: тук покрепче с двойным ударом),
// check.wav (шах: два звонких колокольчика), end.wav (конец партии: восходящее арпеджио). Те же звуки, что рисует веб (web/src/lib/gameSound.ts).
// Запуск из каталога mobile/:  node scripts/generate-game-sounds.cjs
const fs = require('node:fs')
const path = require('node:path')

const RATE = 44100

// детерминированный шум, чтобы файлы не менялись от запуска к запуску
let seed = 12345
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 0xffffffff
}

function track(seconds) {
  return new Float32Array(Math.ceil(RATE * seconds))
}

// глухой «тук»: синус, частота быстро падает, быстрое затухание
function thump(out, at, from, to, length, volume) {
  let phase = 0
  const start = Math.floor(at * RATE)
  const n = Math.floor(length * RATE)
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE
    const freq = from * Math.pow(to / from, t / length)
    phase += (2 * Math.PI * freq) / RATE
    const env = Math.min(1, t / 0.004) * Math.pow(1 - t / length, 3)
    out[start + i] += Math.sin(phase) * env * volume
  }
}

// щелчок: шум через полосовой фильтр (биквад по формулам RBJ)
function click(out, at, length, volume, frequency) {
  const w = (2 * Math.PI * frequency) / RATE
  const alpha = Math.sin(w) / (2 * 1.2)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const b2 = -alpha / a0
  const a1 = (-2 * Math.cos(w)) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  const start = Math.floor(at * RATE)
  const n = Math.floor(length * RATE)
  for (let i = 0; i < n && start + i < out.length; i++) {
    const x = (random() * 2 - 1) * (1 - i / n)
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x; y2 = y1; y1 = y
    out[start + i] += y * volume * 3
  }
}

// нота колокольчика: чистый синус с быстрым нарастанием и плавным затуханием
function chime(out, at, frequency, length, volume) {
  const start = Math.floor(at * RATE)
  const n = Math.floor(length * RATE)
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE
    const env = Math.min(1, t / 0.01) * Math.exp((-5 * t) / length)
    out[start + i] += Math.sin(2 * Math.PI * frequency * t) * env * volume
  }
}

function save(name, samples) {
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767)
  const data = Buffer.from(pcm.buffer)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  const file = path.join(__dirname, '..', 'assets', 'sounds', `${name}.wav`)
  fs.writeFileSync(file, Buffer.concat([header, data]))
  console.log('готово', file, data.length + 44, 'байт')
}

const move = track(0.12)
thump(move, 0, 220, 110, 0.07, 0.6)
click(move, 0, 0.03, 0.25, 1800)
save('move', move)

const capture = track(0.25)
thump(capture, 0, 280, 90, 0.12, 0.6)
click(capture, 0, 0.06, 0.3, 1400)
thump(capture, 0.075, 200, 100, 0.09, 0.45)
save('capture', capture)

const check = track(0.4)
chime(check, 0, 784, 0.16, 0.35)
chime(check, 0.1, 1047, 0.22, 0.35)
save('check', check)

const end = track(1.0)
;[523, 659, 784, 1047].forEach((frequency, i) => chime(end, i * 0.12, frequency, 0.5, 0.3))
save('end', end)
