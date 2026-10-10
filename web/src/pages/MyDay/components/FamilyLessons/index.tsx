import { useEffect, useState } from 'react'
import { getSchedule } from '@/api'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { ChildCard } from './components/ChildCard'
import { List } from './styles'
import type { FamilyLessonsProps, LessonsByChild } from './types'

// сводка уроков всех детей для родителей; у детей вместо неё свой блок TodayLessons
export function FamilyLessons({ now }: FamilyLessonsProps) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const [byChild, setByChild] = useState<LessonsByChild>({})

  const token = identity?.token
  const isParent = !!identity && identity.role !== 'child'
  const children = data?.members.filter((m) => m.role === 'child') ?? []
  // строка вместо массива, чтобы эффект не перезапускался при каждой перерисовке
  const childIds = children.map((c) => c.id).join(',')

  useEffect(() => {
    if (!token || !isParent || !childIds) return
    let cancelled = false
    Promise.all(
      childIds.split(',').map((id) =>
        getSchedule(token, id).then(
          (res) => [id, res.lessons] as const,
          () => [id, null] as const,
        ),
      ),
    ).then((entries) => !cancelled && setByChild(Object.fromEntries(entries)))
    return () => { cancelled = true }
  }, [token, isParent, childIds])

  if (!isParent || children.length === 0) return null

  return (
    <Stack as="section">
      <h2>Уроки детей</h2>
      <List>
        {children.map((child) => (
          <ChildCard key={child.id} child={child} lessons={byChild[child.id]} now={now} />
        ))}
      </List>
    </Stack>
  )
}
