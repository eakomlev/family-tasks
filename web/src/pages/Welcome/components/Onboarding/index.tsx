import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { markOnboardingSeen } from '@/lib/onboarding'
import { SLIDES } from './data'
import { Dot, Dots, Footer, Phone, Root, SlideView, Skip, TopBar, Track } from './styles'

// Знакомство с приложением: слайдер с экранами. «Пропустить» ведёт ко входу, «Начать» на последнем слайде к началу.
// Когда человек долистал до последнего слайда, это запоминается, и в следующий раз слайдов уже нет.
export function Onboarding({ start = 0, onSkip, onDone }: { start?: number; onSkip: () => void; onDone: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(start)
  const last = index === SLIDES.length - 1

  // открытие с нужного слайда (по нажатию на чип на экране приветствия)
  useEffect(() => {
    const el = track.current
    if (el && start > 0) el.scrollLeft = start * el.clientWidth
  }, [start])

  useEffect(() => {
    if (last) markOnboardingSeen()
  }, [last])

  function goTo(i: number) {
    setIndex(i)
    const el = track.current
    el?.scrollTo?.({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  function handleScroll() {
    const el = track.current
    if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <Root>
      <TopBar>
        {!last && <Skip type="button" onClick={onSkip}>Пропустить</Skip>}
      </TopBar>
      <Track ref={track} onScroll={handleScroll} tabIndex={0} aria-label="Возможности приложения">
        {SLIDES.map((s, i) => (
          <SlideView key={s.title} aria-label={`${i + 1} из ${SLIDES.length}`}>
            <Phone>
              <img src={s.image} alt={s.alt} loading={i === 0 ? 'eager' : 'lazy'} draggable={false} />
            </Phone>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </SlideView>
        ))}
      </Track>
      <Footer>
        <Dots>
          {SLIDES.map((s, i) => (
            <Dot key={s.title} type="button" $active={i === index} aria-label={`Слайд ${i + 1}`} aria-current={i === index} onClick={() => goTo(i)} />
          ))}
        </Dots>
        <Button $variant="primary" type="button" onClick={() => (last ? onDone() : goTo(index + 1))}>
          {last ? 'Начать' : 'Далее'}
        </Button>
      </Footer>
    </Root>
  )
}
