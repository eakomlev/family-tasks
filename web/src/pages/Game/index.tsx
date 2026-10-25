import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { ChessBoard } from '@/components/ChessBoard'
import { CheckersBoard } from '@/components/CheckersBoard'
import { TicTacToeBoard } from '@/components/TicTacToeBoard'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { describeGameError } from '@/lib/errors'
import { gameTitle, lastMoveText, myMark, opponentOf, resultText } from '@/lib/games'
import { memberLabel } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { useViewingChat } from '@/realtime/context'
import { ApiError } from '@/api'
import { toApiError } from '@/store/api'
import { useAcceptGameMutation, useInviteToGameMutation, useCancelGameMutation, useDeclineGameMutation, useGetGameQuery, useMoveInGameMutation, usePlaceInGameMutation, usePlayInGameMutation, useResignGameMutation, useOfferDrawMutation, useAcceptDrawMutation, useDeclineDrawMutation } from '@/store/games'
import { Buttons, Caption, Opponent, Result, Status } from './styles'

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
  const [place] = usePlaceInGameMutation()
  const [playChecker] = usePlayInGameMutation()
  const [offerDraw] = useOfferDrawMutation()
  const [acceptDraw] = useAcceptDrawMutation()
  const [declineDraw] = useDeclineDrawMutation()
  const [invite] = useInviteToGameMutation()
  const navigate = useNavigate()
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

  // Новая партия с тем же соперником: приглашение уходит сразу (игра та же), открывается новая игра.
  // Если с ним уже идёт такая игра (соперник успел позвать первым), открывается она.
  const rematch = () =>
    run(async () => {
      if (!game) return
      try {
        const { game: next } = await invite({ kind: game.kind, opponentId: opponentOf(game, me) }).unwrap().catch(toApiError)
        navigate(`/games/${next.id}`, { replace: true })
      } catch (err) {
        const existing = err instanceof ApiError && err.code === 'game_exists' ? (err.body as { game?: { id: string } } | undefined)?.game : undefined
        if (!existing) throw err
        navigate(`/games/${existing.id}`, { replace: true })
      }
    })

  async function onResign() {
    const ok = await confirm({ title: 'Сдаться?', message: 'Партия закончится вашим поражением.', confirmLabel: 'Сдаться', danger: true })
    if (ok) void run(() => call(resign({ id: id! })))
  }

  return (
    <Page>
      <PageHeader to="/">{title}</PageHeader>
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
              <Notice $tone="muted">{`${opponentName} приглашает вас сыграть. ${game.kind === 'chess' ? 'Цвет фигур выберется случайно.' : game.kind === 'checkers' ? 'Цвет шашек выберется случайно.' : 'Кто ходит первым, выберется случайно.'}`}</Notice>
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
              {game.status === 'active' && <Status>{game.turnId === me ? 'Ваш ход' : `Ход: ${opponentName}`}</Status>}
              {game.kind === 'tictactoe' ? (
                <>
                  <TicTacToeBoard
                    board={game.board ?? '---------'}
                    lastCell={game.lastCell}
                    canMove={game.status === 'active' && game.turnId === me && !busy}
                    onPlace={(cell) => void run(() => call(place({ id, cell })))}
                  />
                  <Caption>{`Вы играете: ${myMark(game, me)}${game.whiteId === me ? ' · вы ходите первым' : ''}`}</Caption>
                </>
              ) : game.kind === 'checkers' ? (
                <>
                  <CheckersBoard
                    board={game.board ?? ''}
                    legal={game.legal ?? []}
                    lastPath={game.lastPath ?? null}
                    orientation={game.whiteId === me ? 'w' : 'b'}
                    canMove={game.status === 'active' && game.turnId === me && !busy}
                    onPlay={(path) => void run(() => call(playChecker({ id, path })))}
                  />
                  <Caption>{`${game.whiteId === me ? 'Вы играете белыми' : 'Вы играете чёрными'}${lastMoveText(game) ? ` · ${lastMoveText(game)}` : ''}`}</Caption>
                </>
              ) : (
                <>
                  <ChessBoard
                    fen={game.fen}
                    orientation={game.whiteId === me ? 'w' : 'b'}
                    lastMove={game.lastMove}
                    canMove={game.status === 'active' && game.turnId === me && !busy}
                    onMove={(from, to, promotion) => void run(() => call(move({ id, from, to, promotion })))}
                  />
                  <Caption>{`${game.whiteId === me ? 'Вы играете белыми' : 'Вы играете чёрными'}${lastMoveText(game) ? ` · ${lastMoveText(game)}` : ''}`}</Caption>
                </>
              )}
              {game.status === 'active' && (game.kind === 'chess' || game.kind === 'checkers') && game.drawOffer && game.drawOffer !== me && (
                <Result role="status">
                  <Status>{`${opponentName} предлагает ничью`}</Status>
                  <Buttons>
                    <Button $variant="lime" type="button" disabled={busy} onClick={() => void run(() => call(acceptDraw({ id })))}>
                      Принять ничью
                    </Button>
                    <Button type="button" disabled={busy} onClick={() => void run(() => call(declineDraw({ id })))}>
                      Отклонить
                    </Button>
                  </Buttons>
                </Result>
              )}
              {game.status === 'active' && (game.kind === 'chess' || game.kind === 'checkers') && game.drawOffer === me && <Caption>Вы предложили ничью. Ждём ответа.</Caption>}
              {game.status === 'active' && (game.kind === 'chess' || game.kind === 'checkers') && !game.drawOffer && (
                <Button type="button" disabled={busy} onClick={() => void run(() => call(offerDraw({ id })))}>
                  Предложить ничью
                </Button>
              )}
              {game.status === 'active' && (
                <Button type="button" disabled={busy} onClick={() => void onResign()}>
                  Сдаться
                </Button>
              )}
              {game.status === 'finished' && (
                <Result role="status">
                  <Status>{game.result ? resultText(game.result, me) : 'Игра окончена'}</Status>
                  <Buttons>
                    <Button $variant="lime" type="button" disabled={busy} onClick={() => void rematch()}>
                      Новая партия
                    </Button>
                    <Button type="button" disabled={busy} onClick={() => navigate('/')}>
                      Выйти
                    </Button>
                  </Buttons>
                </Result>
              )}
            </>
          )}

          {error && <Notice $tone="error">{error}</Notice>}
        </>
      )}
    </Page>
  )
}
