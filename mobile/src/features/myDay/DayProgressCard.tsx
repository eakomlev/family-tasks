import { Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle } from 'react-native-svg'
import styled from 'styled-components/native'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { tasksHome } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useListGoalsQuery } from '@/store/goals'
import { useListTasksQuery } from '@/store/tasks'
import { countToday, currentGoal, goalProgress, progressTitle } from './dayProgress'

const R = 34
const LENGTH = 2 * Math.PI * R

const Box = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border-radius: ${({ theme }) => theme.radiusCard}px;
  background-color: ${({ theme }) => theme.colors.heroBg};
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.heroBorder};
`

const Track = styled.View`
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.heroTrack};
`

const Fill = styled.View<{ $share: number }>`
  width: ${({ $share }) => Math.round($share * 100)}%;
  height: 10px;
  border-radius: 5px;
  background-color: ${({ theme }) => theme.colors.lime};
`

// Яркий блок «Квеста» наверху «Моего дня»: кольцо выполненных сегодня заданий и у ребёнка путь к ближайшей цели
export function DayProgressCard({ now }: { now: Date }) {
  const router = useRouter()
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const today = todayIso(now)
  const me = identity?.memberId
  const isChild = identity?.role === 'child'
  // тот же запрос, что у «Заданий на сегодня»: данные берутся из общего кэша
  const { data: list } = useListTasksQuery({ from: today, to: today })
  const { data: goals } = useListGoalsQuery(me ?? '', { skip: !isChild || !me })

  const count = list && me ? countToday(list, me, today) : null
  const goal = isChild ? currentGoal(goals?.goals) : null
  const balance = profile?.me.coins ?? 0
  // пока нечего показать (нет ни заданий на сегодня, ни цели), блока нет
  if (!count || (count.total === 0 && !goal)) return null

  const share = count.total > 0 ? count.done / count.total : 0
  const path = goal ? goalProgress(goal, balance) : null

  return (
    <Pressable onPress={() => router.push(tasksHome(identity?.role))} accessibilityRole="button" accessibilityHint={isChild ? undefined : 'Открыть задачи'} disabled={isChild}>
    <Box accessibilityLabel={`Прогресс дня. Сделано заданий: ${count.done} из ${count.total}`}>
      <View style={{ width: 86, height: 86, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={86} height={86} viewBox="0 0 86 86" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx="43" cy="43" r={R} stroke="rgba(255,255,255,0.22)" strokeWidth={9} fill="none" />
          {share > 0 && (
            <Circle
              cx="43"
              cy="43"
              r={R}
              stroke="#c4f04a"
              strokeWidth={9}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${share * LENGTH} ${LENGTH}`}
            />
          )}
        </Svg>
        <Text $weight="black" $size={20} style={{ color: '#ffffff' }}>
          {`${count.done}/${count.total}`}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text $weight="black" $size={17} style={{ color: '#ffffff' }}>
          {progressTitle(count)}
        </Text>
        {path && (
          <View style={{ gap: 6 }}>
            <Track>
              <Fill $share={path.share} />
            </Track>
            <Text $weight="bold" $size={13} style={{ color: '#dcd7ff' }}>
              {path.text}
            </Text>
          </View>
        )}
      </View>
    </Box>
    </Pressable>
  )
}
