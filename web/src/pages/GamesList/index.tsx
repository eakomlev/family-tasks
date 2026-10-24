import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError, type GameKind } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { describeGameError } from '@/lib/errors'
import { GAMES, gameStatusLine, type GameInfo } from '@/lib/games'
import { memberLabel } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useInviteToGameMutation, useListGamesQuery } from '@/store/games'
import { GameButton, Icon, List } from './styles'

// Игры, в которые можно позвать участника семьи. Готовы шахматы, остальные пока заглушки.
// Выбор игры отправляет приглашение (после подтверждения); если с этим участником такая игра уже идёт, открывается она.
export default function GamesList() {
  const { memberId } = useParams()
  const navigate = useNavigate()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const confirm = useConfirm()
  const guard = useInFlight()
  const { data: list } = useListGamesQuery(undefined, { skip: !identity })
  const [invite] = useInviteToGameMutation()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const member = data?.members.find((m) => m.id === memberId)
  if (!identity || !memberId) return null
  if (data && (!member || member.id === identity.memberId)) return <Navigate to="/family" replace />
  const name = member ? memberLabel(member, identity.role) : ''

  const openWith = (kind: string) =>
    list?.games.find((g) => g.kind === kind && (g.status === 'invited' || g.status === 'active') && (g.inviterId === memberId || g.inviteeId === memberId))

  const play = guard(async (info: GameInfo) => {
    if (!info.available || busy) return
    setError(undefined)
    const existing = openWith(info.kind)
    if (existing) return navigate(`/games/${existing.id}`)
    const ok = await confirm({ title: `Пригласить: ${name}?`, message: `${info.title}. Участник получит приглашение и сможет принять его или отклонить.`, confirmLabel: 'Пригласить' })
    if (!ok) return
    setBusy(true)
    try {
      const { game } = await invite({ kind: info.kind as GameKind, opponentId: memberId }).unwrap().catch(toApiError)
      navigate(`/games/${game.id}`)
    } catch (err) {
      const existingGame = err instanceof ApiError && err.code === 'game_exists' ? (err.body as { game?: { id: string } } | undefined)?.game : undefined
      if (existingGame) navigate(`/games/${existingGame.id}`)
      else setError(describeGameError(err))
    } finally {
      setBusy(false)
    }
  })

  return (
    <Page>
      <PageHeader to={`/family/${memberId}`}>{name ? `Играть: ${name}` : 'Играть'}</PageHeader>
      <List>
        {GAMES.map((info) => {
          const open = info.available ? openWith(info.kind) : undefined
          return (
            <li key={info.kind}>
              <GameButton type="button" disabled={!info.available || busy} aria-label={info.available ? `${info.title}: пригласить` : `${info.title}: скоро`} onClick={() => void play(info)}>
                <Icon aria-hidden>{info.emoji}</Icon>
                <div>
                  <strong>{info.title}</strong>
                  <small>{!info.available ? 'Скоро' : open ? gameStatusLine(open, identity.memberId) : 'Пригласить сыграть'}</small>
                </div>
              </GameButton>
            </li>
          )
        })}
      </List>
      {error && <Notice $tone="error">{error}</Notice>}
    </Page>
  )
}
