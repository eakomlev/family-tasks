import { useState } from 'react'
import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { useConfirm } from '@/components/ConfirmDialog'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { describeGameError } from '@/lib/errors'
import { memberLabel } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { useViewingChat } from '@/realtime/context'
import { toApiError } from '@/store/api'
import { useAcceptGameMutation, useCancelGameMutation, useDeclineGameMutation, useGetGameQuery, useMoveInGameMutation, useResignGameMutation } from '@/store/games'
import { ChessBoard } from './ChessBoard'
import { gameTitle, lastMoveText, opponentOf, resultText } from './utils'

// Одна игра: приглашение (принять или отклонить), ожидание ответа, партия и итог.
// Пока экран открыт, сервер знает об этом и не присылает уведомлений о ходах соперника: ход просто появляется на доске.
export function GameScreen({ id }: { id: string }) {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const confirm = useConfirm()
  const guard = useInFlight()
  const query = useGetGameQuery(id, { skip: !identity })
  const [accept] = useAcceptGameMutation()
  const [decline] = useDeclineGameMutation()
  const [cancel] = useCancelGameMutation()
  const [move] = useMoveInGameMutation()
  const [resign] = useResignGameMutation()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  // игра открыта на экране: уведомления о ходах не нужны
  useViewingChat(identity ? `game-${id}` : undefined)

  const game = query.data?.game
  if (!identity) return null
  if (query.isError && !game) {
    const missing = query.error && 'status' in query.error && query.error.status === 404
    if (missing) return <Redirect href="/" />
  }

  const me = identity.memberId
  const opponent = game ? profile?.members.find((m) => m.id === opponentOf(game, me)) : undefined
  const opponentName = opponent ? memberLabel(opponent, identity.role) : 'Соперник'
  const title = game ? gameTitle(game.kind) : 'Игра'

  // общий порядок действия: не больше одного запроса за раз, ошибка показывается под доской
  const run = guard(async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(undefined)
    try {
      await action()
    } catch (err) {
      setError(describeGameError(err))
    } finally {
      setBusy(false)
    }
  })

  const call = (promise: { unwrap: () => Promise<unknown> }) => promise.unwrap().catch(toApiError)

  async function onResign() {
    const ok = await confirm({ title: 'Сдаться?', message: 'Партия закончится вашим поражением.', confirmLabel: 'Сдаться', danger: true })
    if (ok) void run(() => call(resign({ id })))
  }

  return (
    <Screen header={<PageHeader fallback="/">{title}</PageHeader>}>
      {!game && !query.isError && <Text $tone="muted">Загрузка…</Text>}
      {!game && query.isError && <Notice tone="error">Не удалось загрузить игру. Проверьте соединение.</Notice>}

      {game && (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={opponentName} seed={opponent?.id ?? game.id} src={opponent?.avatar} size={44} />
            <View style={{ flex: 1 }}>
              <Heading numberOfLines={1}>{opponentName}</Heading>
              <Text $tone="muted">{title}</Text>
            </View>
          </Card>

          {game.status === 'invited' && game.inviteeId === me && (
            <>
              <Notice>{`${opponentName} приглашает вас сыграть. ${game.kind === 'chess' ? 'Цвет фигур выберется случайно.' : ''}`}</Notice>
              <Button variant="lime" disabled={busy} onPress={() => void run(() => call(accept({ id })))}>
                Принять
              </Button>
              <Button variant="secondary" disabled={busy} onPress={() => void run(() => call(decline({ id })))}>
                Отклонить
              </Button>
            </>
          )}

          {game.status === 'invited' && game.inviterId === me && (
            <>
              <Notice>{`Ждём ответа: ${opponentName} получил приглашение.`}</Notice>
              <Button variant="secondary" disabled={busy} onPress={() => void run(() => call(cancel({ id })))}>
                Отозвать приглашение
              </Button>
            </>
          )}

          {game.status === 'declined' && <Notice tone="warning">{game.inviterId === me ? `${opponentName} отклонил приглашение.` : 'Вы отклонили приглашение.'}</Notice>}
          {game.status === 'cancelled' && <Notice tone="warning">Приглашение отозвано.</Notice>}

          {(game.status === 'active' || game.status === 'finished') && (
            <>
              <Heading style={{ textAlign: 'center' }}>
                {game.status === 'finished' && game.result ? resultText(game.result, me) : game.turnId === me ? 'Ваш ход' : `Ход: ${opponentName}`}
              </Heading>
              <ChessBoard
                fen={game.fen}
                orientation={game.whiteId === me ? 'w' : 'b'}
                lastMove={game.lastMove}
                canMove={game.status === 'active' && game.turnId === me && !busy}
                onMove={(from, to) => void run(() => call(move({ id, from, to })))}
              />
              <Text $tone="muted" style={{ textAlign: 'center' }}>
                {`${game.whiteId === me ? 'Вы играете белыми' : 'Вы играете чёрными'}${lastMoveText(game) ? ` · ${lastMoveText(game)}` : ''}`}
              </Text>
              {game.status === 'active' && (
                <Button variant="secondary" disabled={busy} onPress={() => void onResign()}>
                  Сдаться
                </Button>
              )}
            </>
          )}

          {error && <Notice tone="error">{error}</Notice>}
        </>
      )}
    </Screen>
  )
}
