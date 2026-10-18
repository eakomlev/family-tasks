import { Pressable, View } from 'react-native'
import styled from 'styled-components/native'
import { Text } from '@/components/Text'
import { formatTimeRange, type ViewLesson, type ViewTraining } from './schedule'

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.surface};
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
`

const Number = styled.View`
  width: 28px;
  height: 28px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`

// Расписание дня только для чтения: номер урока, предмет, кабинет и время
export function LessonList({ lessons, onPress }: { lessons: ViewLesson[]; onPress?: (lesson: ViewLesson) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {lessons.map((lesson, index) => (
        <Pressable key={lesson.key} disabled={!onPress} onPress={() => onPress?.(lesson)} accessibilityRole={onPress ? 'button' : undefined}>
        <Row>
          <Number>
            <Text $weight="extraBold" $size={13} $tone="accent">
              {String(index + 1)}
            </Text>
          </Number>
          <View style={{ flex: 1 }}>
            <Text $weight="extraBold">{lesson.subject}</Text>
            {lesson.room ? (
              <Text $size={13} $tone="muted">
                {`каб. ${lesson.room}`}
              </Text>
            ) : null}
          </View>
          <Text $size={14} $tone="muted">
            {formatTimeRange(lesson)}
          </Text>
          {onPress && <Text $tone="muted" $size={20}>›</Text>}
        </Row>
        </Pressable>
      ))}
    </View>
  )
}

// Тренировки дня только для чтения
export function TrainingList({ trainings }: { trainings: ViewTraining[] }) {
  return (
    <View style={{ gap: 8 }}>
      {trainings.map((training) => (
        <Row key={training.key}>
          <View style={{ flex: 1 }}>
            <Text $weight="extraBold">{training.title}</Text>
            {training.place ? (
              <Text $size={13} $tone="muted">
                {training.place}
              </Text>
            ) : null}
          </View>
          <Text $size={14} $tone="muted">
            {formatTimeRange(training)}
          </Text>
        </Row>
      ))}
    </View>
  )
}
