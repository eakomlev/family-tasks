import { useState, type ReactNode } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Redirect } from 'expo-router'
import styled, { useTheme } from 'styled-components/native'
import { ApiError, type Member } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { isAdult, isParent } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'

export interface DayInfo {
  value: number
  short: string
  full: string
}

// строка черновика: у неё есть ключ, остальные поля зависят от вида расписания
export interface DraftRow {
  key: string
}

// Вид расписания (уроки или тренировки): всё, чем они отличаются; сам редактор у них общий
export interface ScheduleKind<Row extends DraftRow> {
  title: string
  unit: string
  days: DayInfo[]
  max: number
  // «Урок», «Тренировка»: подпись строки
  itemLabel: string
  // «Составить расписание»
  emptyAction: string
  noDayText: string
  noScheduleText: string
  newRow: () => Row
  // что уйдёт на сервер: по нему видно, есть ли несохранённые правки
  serialize: (days: Record<number, Row[]>) => unknown
  hasInvalidTime: (days: Record<number, Row[]>) => boolean
  defaultDay: () => number
  // содержимое одной строки в режиме правки
  renderFields: (row: Row, change: (patch: Partial<Row>) => void, label: string) => ReactNode
  // строки дня в режиме просмотра
  renderView: (rows: Row[]) => ReactNode
}

interface Props<Row extends DraftRow> {
  kind: ScheduleKind<Row>
  // чьё расписание; пусто: своё
  memberId?: string
  // серверное состояние (undefined, пока грузится); нет данных до загрузки
  saved: Record<number, Row[]> | undefined
  loadFailed: boolean
  // должен бросить ошибку, если не получилось сохранить
  onSave: (memberId: string, days: Record<number, Row[]>) => Promise<void>
}

const Tab = styled(Pressable)<{ $active: boolean }>`
  flex: 1;
  min-width: 44px;
  align-items: center;
  padding: 8px 4px;
  border-radius: 14px;
  background-color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.surface)};
  border-width: 1.5px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.border)};
`

const RowCard = styled.View`
  gap: 8px;
  padding: 12px;
  border-radius: 18px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`

// Вкладки дней недели со счётчиком записей в каждом
function DayTabs({ days, selected, counts, unit, onSelect }: { days: DayInfo[]; selected: number; counts: Record<number, number>; unit: string; onSelect: (day: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="tablist">
      {days.map((day) => {
        const active = selected === day.value
        return (
          <Tab key={day.value} $active={active} onPress={() => onSelect(day.value)} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={`${day.full}, ${unit}: ${counts[day.value] ?? 0}`}>
            <Text $weight="extraBold" $size={14} style={{ color: active ? '#ffffff' : undefined }}>
              {day.short}
            </Text>
            <Text $size={12} $weight="bold" style={{ color: active ? '#ffffff' : undefined, opacity: 0.8 }}>
              {counts[day.value] ? String(counts[day.value]) : '·'}
            </Text>
          </Tab>
        )
      })}
    </View>
  )
}

// Один редактор для двух случаев: ребёнок правит своё (из профиля), родитель правит расписание ребёнка (со страницы ребёнка).
// По умолчанию просмотр, «Изменить» открывает редактор с черновиком.
export function ScheduleEditor<Row extends DraftRow>({ kind, memberId: paramId, saved, loadFailed, onSave }: Props<Row>) {
  const guard = useInFlight()
  const { identity } = useIdentity()
  const confirm = useConfirm()
  const { data } = useProfile()
  const { colors } = useTheme()

  // saved — то, что лежит на сервере; draft — правки в режиме редактирования
  const [draft, setDraft] = useState<Record<number, Row[]>>()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [day, setDay] = useState(kind.defaultDay)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [justSaved, setJustSaved] = useState(false)

  const isChild = identity?.role === 'child'
  const memberId = paramId ?? identity?.memberId
  const isOwn = memberId === identity?.memberId
  const target: Member | undefined = data?.members.find((m) => m.id === memberId)
  // бабушка и дедушка расписание только смотрят, менять могут сам ребёнок и родители
  const canEdit = isOwn || isParent(identity?.role)
  const allowed = isOwn ? isChild : isAdult(identity?.role) && (!data || target?.role === 'child')

  if (!identity || !memberId || !allowed) return <Redirect href={isChild ? '/profile' : '/family'} />

  const editing = mode === 'edit'
  const days = editing ? draft : saved
  const dayRows = days?.[day] ?? []
  const counts = Object.fromEntries(kind.days.map((d) => [d.value, days?.[d.value]?.length ?? 0]))
  const hasAny = Object.values(saved ?? {}).some((list) => list.length > 0)
  // есть ли несохранённые правки: сравниваем то, что реально уйдёт на сервер
  const isDirty = !!draft && !!saved && JSON.stringify(kind.serialize(draft)) !== JSON.stringify(kind.serialize(saved))

  function startEditing() {
    if (!saved) return
    setDraft(saved)
    setError(undefined)
    setJustSaved(false)
    setMode('edit')
  }

  async function cancelEditing() {
    if (isDirty && !(await confirm({ title: 'Отменить изменения?', message: 'Несохранённые правки пропадут.', confirmLabel: 'Отменить изменения', danger: true }))) return
    setDraft(undefined)
    setError(undefined)
    setMode('view')
  }

  function editDay(update: (list: Row[]) => Row[]) {
    setDraft((current) => current && { ...current, [day]: update(current[day] ?? []) })
    setError(undefined)
  }

  const move = (index: number, delta: number) =>
    editDay((list) => {
      const next = [...list]
      const to = index + delta
      if (to < 0 || to >= next.length) return list
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })

  const handleSave = guard(async () => {
    if (!draft) return
    if (kind.hasInvalidTime(draft)) {
      setError('У некоторых записей время окончания раньше начала или совпадает с ним.')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      await onSave(memberId, draft)
      setDraft(undefined)
      setJustSaved(true)
      setMode('view')
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'invalid_time' ? 'У некоторых записей время окончания раньше начала.' : 'Не удалось сохранить расписание. Попробуйте ещё раз.')
    } finally {
      setSaving(false)
    }
  })

  const fallback = isOwn ? '/profile' : ({ pathname: '/family/[memberId]', params: { memberId } } as const)

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback={fallback}>← Назад</BackLink>
      <Title>{kind.title}</Title>
      {!isOwn && target && <Text $tone="muted">{target.name}</Text>}

      {loadFailed && <Notice tone="error">Не удалось загрузить расписание. Проверьте соединение.</Notice>}
      {!saved && !loadFailed && <Text $tone="muted">Загрузка…</Text>}

      {days && (
        <Stack>
          <DayTabs days={kind.days} selected={day} counts={counts} unit={kind.unit} onSelect={setDay} />
          <Heading>{kind.days.find((d) => d.value === day)?.full}</Heading>

          {editing ? (
            <>
              {dayRows.length === 0 && <Notice>{`${kind.noDayText} Добавьте первую запись.`}</Notice>}
              {dayRows.map((row, index) => {
                const label = `${kind.itemLabel} ${index + 1}`
                return (
                  <RowCard key={row.key}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text $weight="black" $tone="accent" style={{ width: 24 }}>{String(index + 1)}</Text>
                      <View style={{ flex: 1 }} />
                      <Pressable onPress={() => move(index, -1)} disabled={index === 0} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label}: выше`} style={{ opacity: index === 0 ? 0.3 : 1 }}>
                        <Text $size={20}>↑</Text>
                      </Pressable>
                      <Pressable onPress={() => move(index, 1)} disabled={index === dayRows.length - 1} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label}: ниже`} style={{ opacity: index === dayRows.length - 1 ? 0.3 : 1 }}>
                        <Text $size={20}>↓</Text>
                      </Pressable>
                      <Pressable onPress={() => editDay((list) => list.filter((r) => r.key !== row.key))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label}: удалить`}>
                        <Text $size={20} style={{ color: colors.error }}>✕</Text>
                      </Pressable>
                    </View>
                    {kind.renderFields(row, (patch) => editDay((list) => list.map((r) => (r.key === row.key ? { ...r, ...patch } : r))), label)}
                  </RowCard>
                )
              })}

              <Button disabled={dayRows.length >= kind.max} onPress={() => editDay((list) => [...list, kind.newRow()])}>
                + Добавить
              </Button>
              {error && <Notice tone="error">{error}</Notice>}
              <Button variant="primary" disabled={saving} onPress={handleSave}>
                {saving ? 'Сохраняем…' : 'Сохранить расписание'}
              </Button>
              <Button disabled={saving} onPress={cancelEditing}>
                Отмена
              </Button>
            </>
          ) : (
            <>
              {dayRows.length === 0 && <Notice>{hasAny ? kind.noDayText : kind.noScheduleText}</Notice>}
              {kind.renderView(dayRows)}
              {justSaved && <Notice>Расписание сохранено.</Notice>}
              {canEdit && (
                <Button variant="primary" onPress={startEditing}>
                  {hasAny ? 'Изменить' : kind.emptyAction}
                </Button>
              )}
            </>
          )}
        </Stack>
      )}
    </Screen>
  )
}
