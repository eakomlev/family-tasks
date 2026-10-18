// Генерирует звук отправки сообщения (assets/sounds/send.wav): очень короткий мягкий «поп» (0,1 с), тон быстро идёт вверх и затухает.
// Запуск из каталога mobile/:  node scripts/generate-sound.cjs
const fs = require('node:fs')
const path = require('node:path')

const RATE = 44100
const DURATION = 0.1
const total = Math.floor(RATE * DURATION)
const samples = new Int16Array(total)
let phase = 0
for (let i = 0; i < total; i++) {
  const t = i / RATE
  // тон поднимается с 260 до 960 Гц за 30 мс
  const freq = 260 + 700 * Math.min(1, t / 0.03)
  phase += (2 * Math.PI * freq) / RATE
  // нарастание 2 мс и быстрое затухание
  const env = Math.min(1, t / 0.002) * Math.exp(-t * 55)
  samples[i] = Math.round(Math.sin(phase) * env * 0.5 * 32767)
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
