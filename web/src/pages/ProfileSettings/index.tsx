import { useState } from 'react'
import { SlideInPage as Page } from '@/components/Page'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { isSendSoundOn, setSendSoundOn } from '@/lib/sendFeedback'
import { isGameSoundOn, setGameSoundOn } from '@/lib/gameSound'
import { Checkbox } from '@/components/Checkbox'
import { FONT_SCALE_STEP, MAX_FONT_SCALE, MIN_FONT_SCALE, getFontScale, setFontScale } from '@/lib/fontScale'
import { Preview, Row } from './styles'

// Настройки: размер шрифта (как в приложении, от 80% до 150%)
export default function ProfileSettings() {
  const [scale, setScale] = useState(getFontScale)
  const [sound, setSound] = useState(isSendSoundOn)
  const [gameSound, setGameSound] = useState(isGameSoundOn)

  return (
    <Page>
      <PageHeader to="/profile">Настройки</PageHeader>
      <Row>
        <label htmlFor="font-scale">Размер шрифта: {Math.round(scale * 100)}%</label>
        <input
          id="font-scale"
          type="range"
          min={MIN_FONT_SCALE}
          max={MAX_FONT_SCALE}
          step={FONT_SCALE_STEP}
          value={scale}
          onChange={(e) => setScale(setFontScale(Number(e.target.value)))}
        />
        <Preview>Так будет выглядеть текст в приложении.</Preview>
        {scale !== 1 && (
          <Button type="button" $variant="text" onClick={() => setScale(setFontScale(1))}>
            Стандартный размер
          </Button>
        )}
      </Row>
      <Row>
        <Checkbox checked={sound} onChange={(e) => { setSound(e.target.checked); setSendSoundOn(e.target.checked) }}>
          Звук и вибрация при отправке сообщения
        </Checkbox>
      </Row>
      <Row>
        <Checkbox checked={gameSound} onChange={(e) => { setGameSound(e.target.checked); setGameSoundOn(e.target.checked) }}>
          Звуки в играх (ходы, взятия, шах)
        </Checkbox>
      </Row>
    </Page>
  )
}
