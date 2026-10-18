import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { FAMILY_CHAT } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { buildLessonReport, GRADES, MAX_COMMENT } from '@/lib/lessonReport'
import { useInFlight } from '@/lib/useInFlight'
import { toApiError } from '@/store/api'
import { useSendMessageMutation } from '@/store/chat'
import { gradeTone } from './gradeTone'

// «Что ты хочешь сообщить!»: ребёнок выбирает оценку за урок и/или пишет сообщение, из этого собирается сообщение в общий чат
export function LessonReportScreen({ subject: rawSubject }: { subject?: string }) {
  const guard = useInFlight()
  const router = useRouter()
  const [sendMessage] = useSendMessageMutation()
  const { identity } = useIdentity()
  const subject = rawSubject?.trim() ?? ''

  const [grade, setGrade] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // страница для детей и только для урока из расписания
  if (!identity || identity.role !== 'child' || subject === '') return <Redirect href="/" />

  const text = buildLessonReport(subject, grade, comment)

  const send = guard(async () => {
    if (!text) return
    setBusy(true)
    setError(undefined)
    try {
      await sendMessage({ chat: FAMILY_CHAT, text }).unwrap().catch(toApiError)
      router.replace({ pathname: '/chat/[chat]', params: { chat: FAMILY_CHAT } })
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
      setBusy(false)
    }
  })

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback="/">← Мой день</BackLink>
      <Title>Что ты хочешь сообщить!</Title>
      <Text $weight="extraBold" $tone="accent">{`Урок «${subject}»`}</Text>

      <Stack>
        <View style={{ gap: 8 }} accessibilityLabel="Оценка">
          <Text $weight="extraBold" $size={14} $tone="muted">Оценка</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {GRADES.map((g) => {
              const active = grade === g
              return (
                <Pressable
                  key={g}
                  // повторное нажатие снимает выбор
                  onPress={() => setGrade((current) => (current === g ? null : g))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{ flex: 1, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: gradeTone(g), backgroundColor: active ? gradeTone(g) : 'transparent' }}
                >
                  <Text $weight="black" $size={26} style={{ color: active ? '#ffffff' : gradeTone(g) }}>
                    {String(g)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Field label="Сообщение" hint="Необязательно, если выбрана оценка.">
          <Input
            value={comment}
            onChangeText={setComment}
            maxLength={MAX_COMMENT}
            multiline
            numberOfLines={4}
            placeholder="Например, сдал контрольную"
            style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
          />
        </Field>

        {error && <Notice tone="error">{error}</Notice>}
        <Button variant="primary" disabled={!text || busy} onPress={send}>
          {busy ? 'Отправляем…' : 'Отправить в общий чат'}
        </Button>
      </Stack>
    </Screen>
  )
}
