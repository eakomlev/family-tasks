import { useEffect, useRef } from 'react'
import type { Game } from '@/api'
import { playGameSound } from '@/lib/sound'
import { isGameSoundOn, soundForUpdate } from './gameSound'

// Озвучивает игру на экране: каждый новый ход (свой и соперника), взятие, шах и конец партии.
export function useGameSounds(game: Game | undefined): void {
  const previous = useRef<Game | undefined>(undefined)
  useEffect(() => {
    if (!game) return
    const sound = soundForUpdate(previous.current, game)
    previous.current = game
    if (sound && isGameSoundOn()) playGameSound(sound)
  }, [game])
}
