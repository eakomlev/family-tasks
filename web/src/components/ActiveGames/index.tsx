import { Avatar } from '@/components/Avatar'
import { useIdentity } from '@/identity/context'
import { gameStatusLine, gameTitle, needsMyAction, openGames, opponentOf } from '@/lib/games'
import { memberLabel } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useListGamesQuery } from '@/store/games'
import { List, Row, Section } from './styles'

// «Мой день»: идущие игры и приглашения; те, где ждут меня (ответить или сходить), выше и выделены
export function ActiveGames() {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const { data } = useListGamesQuery(undefined, { skip: !identity })
  if (!identity || !data) return null
  const games = openGames(data.games, identity.memberId)
  if (games.length === 0) return null

  return (
    <Section aria-label="Игры">
      <h2>Игры</h2>
      <List>
        {games.map((game) => {
          const opponent = profile?.members.find((m) => m.id === opponentOf(game, identity.memberId))
          const name = opponent ? memberLabel(opponent, identity.role) : 'Соперник'
          return (
            <li key={game.id}>
              <Row to={`/games/${game.id}`} data-mine={needsMyAction(game, identity.memberId)}>
                <Avatar name={name} seed={opponent?.id ?? game.id} src={opponent?.avatar} size="2.5rem" />
                <div>
                  <strong>{`${gameTitle(game.kind)} · ${name}`}</strong>
                  <small>{gameStatusLine(game, identity.memberId)}</small>
                </div>
              </Row>
            </li>
          )
        })}
      </List>
    </Section>
  )
}
