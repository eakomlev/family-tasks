import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Backdrop, Colon, Done, Heading, ITEM_PX, Quick, QuickChip, Sheet, TimeButton, WheelItem, WheelList, Wheels } from './styles'
import type { TimePickerProps } from './types'
import { HOURS, minuteValues, QUICK_TIMES, splitTime } from './utils'

// Одно колесо: прокручивается пальцем с привязкой к значению или выбирается нажатием
function Wheel({ label, values, selected, onSelect }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  const list = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const index = Math.max(0, values.indexOf(selected))

  // колесо стоит на выбранном значении (при открытии и когда значение выбрали иначе: быстрым временем или нажатием)
  useEffect(() => {
    const el = list.current
    if (el && Math.abs(el.scrollTop - index * ITEM_PX) > 1) el.scrollTo({ top: index * ITEM_PX, behavior: 'auto' })
  }, [index])

  useEffect(() => () => clearTimeout(timer.current), [])

  // палец отпущен, колесо остановилось: берём значение под полосой
  function onScroll() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = list.current
      if (!el) return
      const next = values[Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_PX)))]
      if (next !== selected) onSelect(next)
    }, 120)
  }

  return (
    <WheelList ref={list} role="listbox" aria-label={label} onScroll={onScroll}>
      {values.map((value) => (
        <WheelItem key={value} type="button" role="option" aria-selected={value === selected} $selected={value === selected} onClick={() => onSelect(value)}>
          {value}
        </WheelItem>
      ))}
    </WheelList>
  )
}

// Выбор времени: кнопка с крупным значением открывает снизу окно с двумя колёсами (часы и минуты) и быстрыми вариантами.
// Значение применяется кнопкой «Готово»; закрыть без изменений можно Escape и нажатием на затемнение.
export function TimePicker({ label, value, onChange, disabled, minuteStep = 5 }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [hour, minute] = splitTime(draft)

  function show() {
    setDraft(value)
    setOpen(true)
  }

  function close(apply: boolean) {
    if (apply && draft !== value) onChange(draft)
    setOpen(false)
  }

  return (
    <>
      <TimeButton type="button" disabled={disabled} aria-label={`${label}: ${value}`} aria-haspopup="dialog" onClick={show}>
        <small>{label}</small>
        <strong>{value}</strong>
      </TimeButton>
      {open &&
        createPortal(
          <Backdrop onClick={() => close(false)} onKeyDown={(e) => e.key === 'Escape' && close(false)}>
            <Sheet role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
              <Heading>
                <span>{label}</span>
                <strong aria-live="polite">{draft}</strong>
              </Heading>
              <Quick>
                {QUICK_TIMES.map((time) => (
                  <QuickChip key={time} type="button" $active={draft === time} onClick={() => setDraft(time)}>
                    {time}
                  </QuickChip>
                ))}
              </Quick>
              <Wheels>
                <Wheel label="Часы" values={HOURS} selected={hour} onSelect={(h) => setDraft(`${h}:${minute}`)} />
                <Colon aria-hidden>:</Colon>
                <Wheel label="Минуты" values={minuteValues(minuteStep, minute)} selected={minute} onSelect={(m) => setDraft(`${hour}:${m}`)} />
              </Wheels>
              <Done type="button" autoFocus onClick={() => close(true)}>
                Готово
              </Done>
            </Sheet>
          </Backdrop>,
          document.body,
        )}
    </>
  )
}
