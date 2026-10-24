import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { Checkbox } from '@/components/Checkbox'
import { Chip } from '@/components/Chip'
import { SlideInPage as Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { CALENDAR_KINDS, useCalendarSettings, type CalendarView } from '@/lib/calendarSettings'
import { memberLabel } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { Group, Hint, Person, People } from './styles'

const VIEWS: { view: CalendarView; label: string }[] = [
  { view: 'day', label: 'День' },
  { view: 'week', label: 'Неделя' },
  { view: 'month', label: 'Месяц' },
]

// Настройки календаря: какие записи показывать, чьи и с какого вида открывать. Сохраняются сразу, на этом устройстве.
export default function CalendarSettings() {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const [settings, update] = useCalendarSettings(identity?.memberId ?? '')

  if (!identity) return null
  const members = profile?.members ?? []

  const toggleMember = (id: string) =>
    update((current) => ({
      ...current,
      hiddenMembers: current.hiddenMembers.includes(id) ? current.hiddenMembers.filter((x) => x !== id) : [...current.hiddenMembers, id],
    }))

  return (
    <Page>
      <PageHeader to="/calendar">Настройки календаря</PageHeader>

      <Group as="section" aria-label="Что показывать">
        <h2>Что показывать</h2>
        <Stack>
          {CALENDAR_KINDS.map(({ kind, label }) => (
            <Checkbox
              key={kind}
              checked={settings.kinds[kind]}
              onChange={(e) => update((current) => ({ ...current, kinds: { ...current.kinds, [kind]: e.target.checked } }))}
            >
              {label}
            </Checkbox>
          ))}
        </Stack>
      </Group>

      <Group as="section" aria-label="Чьи записи">
        <h2>Чьи записи видны</h2>
        <People>
          {members.map((member) => {
            const shown = !settings.hiddenMembers.includes(member.id)
            return (
              <Person key={member.id} type="button" $active={shown} aria-pressed={shown} onClick={() => toggleMember(member.id)}>
                <Avatar name={memberLabel(member, identity.role)} seed={member.id} src={member.avatar} size="1.8rem" />
                {member.id === identity.memberId ? 'Я' : memberLabel(member, identity.role)}
              </Person>
            )
          })}
        </People>
        <Hint>Праздники и события для всей семьи показываются всегда.</Hint>
      </Group>

      <Group as="section" aria-label="Вид по умолчанию">
        <h2>Открывать календарь</h2>
        <People>
          {VIEWS.map((v) => (
            <Chip key={v.view} type="button" aria-pressed={settings.view === v.view} $active={settings.view === v.view} onClick={() => update((current) => ({ ...current, view: v.view }))}>
              {v.label}
            </Chip>
          ))}
        </People>
      </Group>
    </Page>
  )
}
