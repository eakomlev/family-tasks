// Генерирует короткий тихий звук отправки сообщения (assets/sounds/send.wav): мягкий «блип» с быстро затухающим тоном.
// Запуск из каталога mobile/:  node scripts/generate-sound.cjs
const fs = require('node:fs')
const path = require('node:path')

const RATE = 44100
const DURATION = 0.13
const total = Math.floor(RATE * DURATION)
const samples = new Int16Array(total)
let phase = 0
for (let i = 0; i < total; i++) {
  const t = i / RATE
  // тон плавно идёт вверх (650 → 980 Гц), как лёгкий «пуф»
  const freq = 650 + (980 - 650) * Math.min(1, t / 0.07)
  phase += (2 * Math.PI * freq) / RATE
  // быстрое нарастание (4 мс) и плавное затухание
  const attack = Math.min(1, t / 0.004)
  const decay = Math.exp(-t * 32)
  const wave = Math.sin(phase) + 0.25 * Math.sin(phase * 2)
  samples[i] = Math.round(wave * attack * decay * 0.28 * 32767)
}

const data = Buffer.from(samples.buffer)
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
const out = path.join(__dirname, '..', 'assets', 'sounds', 'send.wav')
fs.writeFileSync(out, Buffer.concat([header, data]))
console.log('готово', out, data.length + 44, 'байт')
