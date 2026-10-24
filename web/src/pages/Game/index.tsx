import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { ChessBoard } from '@/components/ChessBoard'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { describeGameError } from '@/lib/errors'
import { gameTitle, lastMoveText, opponentOf, resultText } from '@/lib/games'
import { memberLabel } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { useViewingChat } from '@/realtime/context'
import { toApiError } from '@/store/api'
import { useAcceptGameMutation, useCancelGameMutation, useDeclineGameMutation, useGetGameQuery, useMoveInGameMutation, useResignGameMutation } from '@/store/games'
import { Buttons, Caption, Opponent, Status } from './styles'

// Одна игра: приглашение (принять или отклонить), ожидание ответа, партия и итог.
// Пока страница открыта, сервер знает об этом и не присылает уведомлений о ходах соперника: ход просто появляется на доске.
export default function Game() {
  const { id } = useParams()
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const confirm = useConfirm()
  const guard = useInFlight()
  const query = useGetGameQuery(id ?? '', { skip: !identity || !id })
  const [accept] = useAcceptGameMutation()
  const [decline] = useDeclineGameMutation()
  const [cancel] = useCancelGameMutation()
  const [move] = useMoveInGameMutation()
  const [resign] = useResignGameMutation()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  // игра открыта на экране: уведомления о ходах не нужны
  useViewingChat(identity && id ? `game-${id}` : undefined)

  const game = query.data?.game
  if (!identity || !id) return null
  if (query.isError && !game && query.error && 'status' in query.error && query.error.status === 404) return <Navigate to="/" replace />

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
    if (ok) void run(() => call(resign({ id: id! })))
  }

  return (
    <Page>
      <BackLink to="/">← {title}</BackLink>
      <h1>{title}</h1>
      {!game && !query.isError && <p>Загрузка…</p>}
      {!game && query.isError && <Notice $tone="error">Не удалось загрузить игру. Проверьте соединение.</Notice>}

      {game && (
        <>
          <Opponent>
            <Avatar name={opponentName} seed={opponent?.id ?? game.id} src={opponent?.avatar} size="2.8rem" />
            <div>
              <strong>{opponentName}</strong>
              <small>{title}</small>
            </div>
          </Opponent>

          {game.status === 'invited' && game.inviteeId === me && (
            <>
              <Notice $tone="muted">{`${opponentName} приглашает вас сыграть. ${game.kind === 'chess' ? 'Цвет фигур выберется случайно.' : ''}`}</Notice>
              <Buttons>
                <Button $variant="primary" type="button" disabled={busy} onClick={() => void run(() => call(accept({ id })))}>
                  Принять
                </Button>
                <Button type="button" disabled={busy} onClick={() => void run(() => call(decline({ id })))}>
                  Отклонить
                </Button>
              </Buttons>
            </>
          )}

          {game.status === 'invited' && game.inviterId === me && (
            <>
              <Notice $tone="muted">{`Ждём ответа: ${opponentName} получил приглашение.`}</Notice>
              <Button type="button" disabled={busy} onClick={() => void run(() => call(cancel({ id })))}>
                Отозвать приглашение
              </Button>
            </>
          )}

          {game.status === 'declined' && <Notice $tone="warning">{game.inviterId === me ? `${opponentName} отклонил приглашение.` : 'Вы отклонили приглашение.'}</Notice>}
          {game.status === 'cancelled' && <Notice $tone="warning">Приглашение отозвано.</Notice>}

          {(game.status === 'active' || game.status === 'finished') && (
            <>
              <Status>{game.status === 'finished' && game.result ? resultText(game.result, me) : game.turnId === me ? 'Ваш ход' : `Ход: ${opponentName}`}</Status>
              <ChessBoard
                fen={game.fen}
                orientation={game.whiteId === me ? 'w' : 'b'}
                lastMove={game.lastMove}
                canMove={game.status === 'active' && game.turnId === me && !busy}
                onMove={(from, to) => void run(() => call(move({ id, from, to })))}
              />
              <Caption>{`${game.whiteId === me ? 'Вы играете белыми' : 'Вы играете чёрными'}${lastMoveText(game) ? ` · ${lastMoveText(game)}` : ''}`}</Caption>
              {game.status === 'active' && (
                <Button type="button" disabled={busy} onClick={() => void onResign()}>
                  Сдаться
                </Button>
              )}
            </>
          )}

          {error && <Notice $tone="error">{error}</Notice>}
        </>
      )}
    </Page>
  )
}
