import { useState } from 'react'
import { Platform, Pressable } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import styled from 'styled-components/native'
import { Text } from '../Text'

const Field = styled(Pressable)`
  min-height: 52px;
  border-radius: 16px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
  padding-horizontal: 16px;
  justify-content: center;
`

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toHm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function parse(value: string, mode: 'date' | 'time'): Date {
  const now = new Date()
  if (!value) return now
  if (mode === 'date') {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
  }
  const [h, min] = value.split(':').map(Number)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h ?? 0, min ?? 0)
}

const display = (value: string, mode: 'date' | 'time') => {
  if (!value) return mode === 'date' ? 'Выбрать дату' : 'Выбрать время'
  if (mode === 'time') return value
  return parse(value, 'date').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

interface Props {
  mode: 'date' | 'time'
  // «YYYY-MM-DD» или «HH:MM», пусто если не выбрано
  value: string
  onChange: (value: string) => void
  // меньше этой даты выбирать нельзя
  min?: string
  accessibilityLabel: string
}

// Выбор даты или времени системным окном (на iPhone встроенный выбор под полем). Значение строкой, как в полях формы.
export function DateTimeField({ mode, value, onChange, min, accessibilityLabel }: Props) {
  const [iosOpen, setIosOpen] = useState(false)
  const current = parse(value, mode)
  const minimumDate = mode === 'date' && min ? parse(min, 'date') : undefined

  const apply = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return
    onChange(mode === 'date' ? toIso(selected) : toHm(selected))
  }

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode, is24Hour: true, minimumDate, onChange: apply })
    } else {
      setIosOpen((o) => !o)
    }
  }

  return (
    <>
      <Field onPress={open} accessibilityRole="button" accessibilityLabel={`${accessibilityLabel}: ${display(value, mode)}`}>
        <Text $tone={value ? 'default' : 'muted'}>{display(value, mode)}</Text>
      </Field>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker value={current} mode={mode} display="spinner" is24Hour minimumDate={minimumDate} locale="ru-RU" onChange={apply} />
      )}
    </>
  )
}
