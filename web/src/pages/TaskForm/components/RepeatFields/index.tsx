import type { RepeatType } from '@/api'
import { Chip } from '@/components/Chip'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Stack } from '@/components/Stack'
import { WEEK_DAYS } from '@/lib/weekdays'
import { Days } from './styles'
import type { RepeatFieldsProps } from './types'

const OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none', label: 'Не повторять' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'По дням недели' },
  { value: 'monthly', label: 'Раз в месяц' },
]

export function RepeatFields({ disabled, repeatType, days, until, min, onTypeChange, onToggleDay, onUntilChange }: RepeatFieldsProps) {
  return (
    <Stack>
      <Field label="Повтор">
        <Select value={repeatType} disabled={disabled} onChange={(e) => onTypeChange(e.target.value as RepeatType)}>
          {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>

      {repeatType === 'weekly' && (
        <Days role="group" aria-label="Дни недели">
          {WEEK_DAYS.map((d) => (
            <Chip key={d.value} type="button" aria-pressed={days.includes(d.value)} $active={days.includes(d.value)} onClick={() => onToggleDay(d.value)}>
              {d.short}
            </Chip>
          ))}
        </Days>
      )}

      {repeatType !== 'none' && (
        <Field label="Повторять до" hint="Необязательно. Без даты повторяется без конца.">
          <Input type="date" value={until} min={min} onChange={(e) => onUntilChange(e.target.value)} />
        </Field>
      )}
    </Stack>
  )
}
