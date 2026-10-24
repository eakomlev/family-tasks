import { useState } from 'react'
import { View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
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
import { ApiError } from '@/api'
import { goBack } from '@/lib/navigation'
import { toApiError } from '@/store/api'
import { useAcceptGameMutation, useInviteToGameMutation, useCancelGameMutation, useDeclineGameMutation, useGetGameQuery, useMoveInGameMutation, usePlaceInGameMutation, useResignGameMutation } from '@/store/games'
import { ChessBoard } from './ChessBoard'
import { TicTacToeBoard } from './TicTacToeBoard'
import { gameTitle, lastMoveText, myMark, opponentOf, resultText } from './utils'

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
  const [place] = usePlaceInGameMutation()
  const [invite] = useInviteToGameMutation()
  const router = useRouter()
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

  // Новая партия с тем же соперником: приглашение уходит сразу (игра та же), открывается новая игра.
  // Если с ним уже идёт такая игра (соперник успел позвать первым), открывается она.
  const rematch = () =>
    run(async () => {
      if (!game) return
      try {
        const { game: next } = await invite({ kind: game.kind, opponentId: opponentOf(game, me) }).unwrap().catch(toApiError)
        router.replace({ pathname: '/games/[id]', params: { id: next.id } })
      } catch (err) {
        const existing = err instanceof ApiError && err.code === 'game_exists' ? (err.body as { game?: { id: string } } | undefined)?.game : undefined
        if (!existing) throw err
        router.replace({ pathname: '/games/[id]', params: { id: existing.id } })
      }
    })

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
              <Notice>{`${opponentName} приглашает вас сыграть. ${game.kind === 'chess' ? 'Цвет фигур выберется случайно.' : 'Кто ходит первым, выберется случайно.'}`}</Notice>
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
              {game.status === 'active' && <Heading style={{ textAlign: 'center' }}>{game.turnId === me ? 'Ваш ход' : `Ход: ${opponentName}`}</Heading>}
              {game.kind === 'tictactoe' ? (
                <>
                  <TicTacToeBoard
                    board={game.board ?? '---------'}
                    lastCell={game.lastCell}
                    canMove={game.status === 'active' && game.turnId === me && !busy}
                    onPlace={(cell) => void run(() => call(place({ id, cell })))}
                  />
                  <Text $tone="muted" style={{ textAlign: 'center' }}>
                    {`Вы играете: ${myMark(game, me)}${game.whiteId === me ? ' · вы ходите первым' : ''}`}
                  </Text>
                </>
              ) : (
                <>
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
                </>
              )}
              {game.status === 'active' && (
                <Button variant="secondary" disabled={busy} onPress={() => void onResign()}>
                  Сдаться
                </Button>
              )}
              {game.status === 'finished' && (
                <Card style={{ gap: 12 }}>
                  <Heading style={{ textAlign: 'center' }}>{game.result ? resultText(game.result, me) : 'Игра окончена'}</Heading>
                  <Button variant="lime" disabled={busy} onPress={() => void rematch()}>
                    Новая партия
                  </Button>
                  <Button variant="secondary" disabled={busy} onPress={() => goBack(router, '/')}>
                    Выйти
                  </Button>
                </Card>
              )}
            </>
          )}

          {error && <Notice tone="error">{error}</Notice>}
        </>
      )}
    </Screen>
  )
}
