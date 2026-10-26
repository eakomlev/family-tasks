import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

let player: AudioPlayer | undefined
let prepared = false

function prepare() {
  if (prepared) return
  prepared = true
  void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {})
}

// Тихий короткий звук отправки сообщения (assets/sounds/send.wav). Не перебивает музыку и подкасты, в беззвучном режиме молчит.
// Любая ошибка звука не должна мешать отправке: просто без звука.
export function playSendSound() {
  try {
    prepare()
    player ??= createAudioPlayer(require('../../assets/sounds/send.wav'))
    void player.seekTo(0)
    player.play()
  } catch {
    /* без звука */
  }
}

// Звуки игр: ход, взятие, шах, конец партии (assets/sounds/*.wav, их делает scripts/generate-game-sounds.cjs). Плееры создаются при первом звуке.
const GAME_SOUNDS = {
  move: () => require('../../assets/sounds/move.wav'),
  capture: () => require('../../assets/sounds/capture.wav'),
  check: () => require('../../assets/sounds/check.wav'),
  end: () => require('../../assets/sounds/end.wav'),
} as const

const gamePlayers: Partial<Record<keyof typeof GAME_SOUNDS, AudioPlayer>> = {}

export function playGameSound(kind: keyof typeof GAME_SOUNDS) {
  try {
    prepare()
    const ready = (gamePlayers[kind] ??= createAudioPlayer(GAME_SOUNDS[kind]()))
    void ready.seekTo(0)
    ready.play()
  } catch {
    /* без звука */
  }
}
