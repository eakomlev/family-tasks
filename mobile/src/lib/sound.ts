import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

let player: AudioPlayer | undefined
let prepared = false

// Тихий короткий звук отправки сообщения (assets/sounds/send.wav). Не перебивает музыку и подкасты, в беззвучном режиме молчит.
// Любая ошибка звука не должна мешать отправке: просто без звука.
export function playSendSound() {
  try {
    if (!prepared) {
      prepared = true
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {})
    }
    player ??= createAudioPlayer(require('../../assets/sounds/send.wav'))
    void player.seekTo(0)
    player.play()
  } catch {
    /* без звука */
  }
}
