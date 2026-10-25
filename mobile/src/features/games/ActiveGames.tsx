import { Pressable, View } from 'react-native'
import { ZoneTitle } from '@/components/ZoneTitle'
import { useRouter } from 'expo-router'
import { Avatar } from '@/components/Avatar'
import { Card } from '@/components/Card'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { memberLabel } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useListGamesQuery } from '@/store/games'
import { gameTitle, gameStatusLine, needsMyAction, openGames, opponentOf } from './utils'

// «Мой день»: идущие игры и приглашения; те, где ждут меня (ответить или сходить), выше и выделены
export function ActiveGames() {
  const router = useRouter()
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const { data } = useListGamesQuery(undefined, { skip: !identity })
  if (!identity || !data) return null
  const games = openGames(data.games, identity.memberId)
  if (games.length === 0) return null

  return (
    <Stack $gap={8}>
      <ZoneTitle tone="games" icon="games" count={games.length}>
        Игры
      </ZoneTitle>
      <Card style={{ gap: 4, paddingVertical: 8 }}>
        {games.map((game) => {
          const opponent = profile?.members.find((m) => m.id === opponentOf(game, identity.memberId))
          const mine = needsMyAction(game, identity.memberId)
          const name = opponent ? memberLabel(opponent, identity.role) : 'Соперник'
          return (
            <Pressable
              key={game.id}
              onPress={() => router.push({ pathname: '/games/[id]', params: { id: game.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${gameTitle(game.kind)} с ${name}: ${gameStatusLine(game, identity.memberId)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
            >
              <Avatar name={name} seed={opponent?.id ?? game.id} src={opponent?.avatar} size={40} />
              <View style={{ flex: 1 }}>
                <Text $weight="extraBold" numberOfLines={1}>{`${gameTitle(game.kind)} · ${name}`}</Text>
                <Text $size={13} $weight={mine ? 'extraBold' : undefined} $tone={mine ? 'accent' : 'muted'}>
                  {gameStatusLine(game, identity.memberId)}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </Card>
    </Stack>
  )
}
