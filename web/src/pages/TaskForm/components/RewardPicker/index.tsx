import { Chip } from '@/components/Chip'
import { Input } from '@/components/Input'
import { REWARD_CHOICES } from '@/lib/coins'
import { Chips, Group, Hint, Title } from './styles'
import type { RewardPickerProps } from './types'

// Выбор награды монетами: готовые плашки и «Другая» с полем для своего числа от 1 до 1000.
export function RewardPicker({ value, custom, onChange }: RewardPickerProps) {
  return (
    <Group role="group" aria-label="Награда">
      <Title>Награда, монет</Title>
      <Chips>
        {REWARD_CHOICES.map((n) => {
          const active = !custom && Number(value) === n
          return (
            <Chip key={n} type="button" aria-pressed={active} $active={active} onClick={() => onChange(String(n), false)}>
              {n === 0 ? 'Без награды' : n}
            </Chip>
          )
        })}
        <Chip type="button" aria-pressed={custom} $active={custom} onClick={() => onChange(custom ? value : '', true)}>
          Другая
        </Chip>
      </Chips>
      {custom && (
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          step={1}
          value={value}
          placeholder="От 1 до 1000"
          aria-label="Своя награда, монет"
          autoFocus
          onChange={(e) => onChange(e.target.value, true)}
        />
      )}
      <Hint>Ребёнок получит монеты, когда задание будет выполнено. У повторяющегося задания за каждое выполнение.</Hint>
    </Group>
  )
}
