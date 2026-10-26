import { Chess } from 'chess.js'
import type { Game } from '@/api'

// Звук в игре: ход, взятие, шах, конец партии. Решает по двум последним состояниям игры (`soundForUpdate`), играет WebAudio
// (файлов нет, звук рисуется на лету). Выключается в «Настройках».
export type GameSound = 'move' | 'capture' | 'check' | 'end'

const KEY = 'gameSound'

export function isGameSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setGameSoundOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, '0')
  } catch {
    /* хранилища нет: настройка не сохранится, не страшно */
  }
}

// сколько фигур на доске по строке расстановки из FEN или по полю шашек
const pieces = (placement: string) => placement.replace(/[^a-zA-Z]/g, '').length

// Какой звук сопровождает переход игры из состояния prev в next. Первое состояние (открыли страницу) и чужая игра звука не дают.
export function soundForUpdate(prev: Game | undefined, next: Game): GameSound | null {
  if (!prev || prev.id !== next.id) return null
  if (prev.status === 'active' && next.status === 'finished') return 'end'
  if (next.status !== 'active') return null

  if (next.kind === 'chess') {
    if (prev.fen === next.fen) return null
    if (pieces(next.fen.split(' ')[0]) < pieces(prev.fen.split(' ')[0])) return 'capture'
    try {
      if (new Chess(next.fen).isCheck()) return 'check'
    } catch {
      /* непонятная позиция: просто ход */
    }
    return 'move'
  }
  if (!prev.board || !next.board || prev.board === next.board) return null
  // шашки: на поле только буквы фигур, у крестиков-ноликов «X»/«O» (взятий нет)
  if (next.kind === 'checkers' && pieces(next.board) < pieces(prev.board)) return 'capture'
  return 'move'
}

let context: AudioContext | undefined

function audio(): AudioContext | undefined {
  const Ctor = window.AudioContext
  if (!Ctor) return undefined
  context ??= new Ctor()
  if (context.state === 'suspended') void context.resume()
  return context
}

// глухой «тук» дерева: тон быстро идёт вниз и затухает
function thump(ctx: AudioContext, at: number, from: number, to: number, length: number, volume: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + length)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

// короткий шум (щелчок о доску), пропущенный через полосовой фильтр
function click(ctx: AudioContext, at: number, length: number, volume: number, frequency: number) {
  const size = Math.max(1, Math.floor(ctx.sampleRate * length))
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  const gain = ctx.createGain()
  gain.gain.value = volume
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start(at)
}

// чистая нота колокольчика
function chime(ctx: AudioContext, at: number, frequency: number, length: number, volume: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

export function playGameSound(sound: GameSound): void {
  if (!isGameSoundOn()) return
  try {
    const ctx = audio()
    if (!ctx) return
    const t = ctx.currentTime
    if (sound === 'move') {
      thump(ctx, t, 220, 110, 0.07, 0.28)
      click(ctx, t, 0.03, 0.18, 1800)
    } else if (sound === 'capture') {
      thump(ctx, t, 280, 90, 0.12, 0.4)
      click(ctx, t, 0.06, 0.3, 1400)
      thump(ctx, t + 0.075, 200, 100, 0.09, 0.28)
    } else if (sound === 'check') {
      chime(ctx, t, 784, 0.16, 0.14)
      chime(ctx, t + 0.1, 1047, 0.22, 0.14)
    } else {
      ;[523, 659, 784, 1047].forEach((frequency, i) => chime(ctx, t + i * 0.12, frequency, 0.5, 0.12))
    }
  } catch {
    /* звук не обязателен */
  }
}
