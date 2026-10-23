import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { useTheme } from 'styled-components/native'
import { ApiError } from '@/api'
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
import { toApiError } from '@/store/api'
import { useInviteToGameMutation, useListGamesQuery } from '@/store/games'
import { GAMES, gameStatusLine, type GameInfo } from './utils'

// Игры, в которые можно позвать участника семьи. Готовы шахматы, остальные пока заглушки.
// Выбор игры отправляет приглашение (после подтверждения); если с этим участником такая игра уже идёт, открывается она.
export function GamesListScreen({ memberId }: { memberId: string }) {
  const router = useRouter()
  const { colors } = useTheme()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const confirm = useConfirm()
  const guard = useInFlight()
  const { data: list } = useListGamesQuery(undefined, { skip: !identity })
  const [invite] = useInviteToGameMutation()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  if (!identity) return null
  const member = data?.members.find((m) => m.id === memberId)
  if (data && (!member || member.id === identity.memberId)) return <Redirect href="/family" />
  const name = member ? memberLabel(member, identity.role) : ''

  const openWith = (kind: string) =>
    list?.games.find((g) => g.kind === kind && (g.status === 'invited' || g.status === 'active') && (g.inviterId === memberId || g.inviteeId === memberId))

  const play = guard(async (info: GameInfo) => {
    if (!info.available || busy) return
    setError(undefined)
    const existing = openWith(info.kind)
    if (existing) return router.push({ pathname: '/games/[id]', params: { id: existing.id } })
    const ok = await confirm({ title: `Пригласить: ${name}?`, message: `${info.title}. Участник получит приглашение и сможет принять его или отклонить.`, confirmLabel: 'Пригласить' })
    if (!ok) return
    setBusy(true)
    try {
      const { game } = await invite({ kind: info.kind as 'chess', opponentId: memberId }).unwrap().catch(toApiError)
      router.push({ pathname: '/games/[id]', params: { id: game.id } })
    } catch (err) {
      const existingGame = err instanceof ApiError && err.code === 'game_exists' ? (err.body as { game?: { id: string } } | undefined)?.game : undefined
      if (existingGame) router.push({ pathname: '/games/[id]', params: { id: existingGame.id } })
      else setError(describeGameError(err))
    } finally {
      setBusy(false)
    }
  })

  return (
    <Screen header={<PageHeader fallback={{ pathname: '/family/[memberId]', params: { memberId } }}>{name ? `Играть: ${name}` : 'Играть'}</PageHeader>}>
      {GAMES.map((info) => {
        const open = info.available ? openWith(info.kind) : undefined
        return (
          <Pressable
            key={info.kind}
            disabled={!info.available || busy}
            onPress={() => void play(info)}
            accessibilityRole="button"
            accessibilityLabel={info.available ? `${info.title}: пригласить` : `${info.title}: скоро`}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, opacity: info.available ? 1 : 0.6 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                <Text $size={28}>{info.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Heading>{info.title}</Heading>
                <Text $tone={open ? 'accent' : 'muted'}>{!info.available ? 'Скоро' : open ? gameStatusLine(open, identity.memberId) : 'Пригласить сыграть'}</Text>
              </View>
            </Card>
          </Pressable>
        )
      })}
      {error && <Notice tone="error">{error}</Notice>}
    </Screen>
  )
}
