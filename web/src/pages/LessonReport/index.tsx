import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { FAMILY_CHAT, sendMessage } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { Textarea } from '@/components/Textarea'
import { useIdentity } from '@/identity/context'
import { buildLessonReport, GRADES, MAX_COMMENT } from '@/lib/lessonReport'
import { START_PATH } from '@/lib/routes'
import { Grade, Grades, Label, Subject } from './styles'
import { gradeTone } from './utils'
import { useInFlight } from '@/lib/useInFlight'

// «Что ты хочешь сообщить!»: ребёнок выбирает оценку за урок и/или пишет сообщение, из этого собирается сообщение в общий чат.
export default function LessonReport() {
  const guard = useInFlight()
  const { identity } = useIdentity()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const subject = params.get('subject')?.trim() ?? ''

  const [grade, setGrade] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // страница для детей и только для урока из расписания
  if (!identity || identity.role !== 'child' || subject === '') return <Navigate to={START_PATH} replace />

  const text = buildLessonReport(subject, grade, comment)

  const send = guard(async () => {
    if (!text || !identity) return
    setBusy(true)
    setError(undefined)
    try {
      await sendMessage(identity.token, FAMILY_CHAT, text)
      navigate(`/chat/${FAMILY_CHAT}`, { replace: true })
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
      setBusy(false)
    }
  })

  return (
    <Page>
      <BackLink to={START_PATH}>← Мой день</BackLink>
      <h1>Что ты хочешь сообщить!</h1>
      <Subject>Урок «{subject}»</Subject>

      <Stack as="form" onSubmit={(e) => { e.preventDefault(); void send() }}>
        <div role="group" aria-label="Оценка">
          <Label>Оценка</Label>
          <Grades>
            {GRADES.map((g) => (
              <Grade
                key={g}
                type="button"
                $active={grade === g}
                $tone={gradeTone(g)}
                aria-pressed={grade === g}
                // повторное нажатие снимает выбор
                onClick={() => setGrade((current) => (current === g ? null : g))}
              >
                {g}
              </Grade>
            ))}
          </Grades>
        </div>

        <Field label="Сообщение" hint="Необязательно, если выбрана оценка.">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={MAX_COMMENT} rows={4} placeholder="Например, сдал контрольную" />
        </Field>

        {error && <Notice $tone="error">{error}</Notice>}
        <Button $variant="primary" type="submit" disabled={!text || busy}>
          {busy ? 'Отправляем…' : 'Отправить в общий чат'}
        </Button>
      </Stack>
    </Page>
  )
}
