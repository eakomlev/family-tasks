import { Pressable, View } from 'react-native'
import { useTheme } from 'styled-components/native'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { Checkbox } from '@/components/Checkbox'
import { Chip } from '@/components/Chip'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { CALENDAR_KINDS, useCalendarSettings, type CalendarView } from '@/lib/calendarSettings'
import { memberLabel } from '@/lib/roles'
import { useProfile } from '@/profile/context'

const VIEWS: { view: CalendarView; label: string }[] = [
  { view: 'day', label: 'День' },
  { view: 'week', label: 'Неделя' },
  { view: 'month', label: 'Месяц' },
]

// Настройки календаря: какие записи показывать, чьи и с какого вида открывать. Сохраняются сразу, на этом устройстве.
export function CalendarSettingsScreen() {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const { colors } = useTheme()
  const [settings, update] = useCalendarSettings(identity?.memberId ?? '')

  if (!identity) return null
  const members = profile?.members ?? []

  const toggleMember = (id: string) =>
    update((current) => ({
      ...current,
      hiddenMembers: current.hiddenMembers.includes(id) ? current.hiddenMembers.filter((x) => x !== id) : [...current.hiddenMembers, id],
    }))

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback="/calendar">← Календарь</BackLink>
      <Title>Настройки календаря</Title>

      <Stack $gap={8}>
        <Heading>Что показывать</Heading>
        {CALENDAR_KINDS.map(({ kind, label }) => (
          <Checkbox key={kind} checked={settings.kinds[kind]} onChange={(checked) => update((current) => ({ ...current, kinds: { ...current.kinds, [kind]: checked } }))}>
            {label}
          </Checkbox>
        ))}
      </Stack>

      <Stack $gap={8}>
        <Heading>Чьи записи видны</Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {members.map((member) => {
            const shown = !settings.hiddenMembers.includes(member.id)
            return (
              <Pressable
                key={member.id}
                onPress={() => toggleMember(member.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: shown }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: shown ? colors.accent : colors.border, backgroundColor: shown ? colors.accentSoft : colors.surface }}
              >
                <Avatar name={memberLabel(member, identity.role)} seed={member.id} src={member.avatar} size={26} />
                <Text $weight="bold" $size={14}>
                  {member.id === identity.memberId ? 'Я' : memberLabel(member, identity.role)}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Text $size={13} $tone="muted">
          Праздники и события для всей семьи показываются всегда.
        </Text>
      </Stack>

      <Stack $gap={8}>
        <Heading>Открывать календарь</Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {VIEWS.map((v) => (
            <Chip key={v.view} active={settings.view === v.view} onPress={() => update((current) => ({ ...current, view: v.view }))}>
              {v.label}
            </Chip>
          ))}
        </View>
      </Stack>
    </Screen>
  )
}
