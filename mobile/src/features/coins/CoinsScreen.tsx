import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, View } from 'react-native'
import { Redirect } from 'expo-router'
import styled, { useTheme } from 'styled-components/native'
import { listCoinHistory, type CoinEntry } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { CoinIcon } from '@/components/Coins'
import { Notice } from '@/components/Notice'
import { TOP_CORNER } from '@/components/Screen'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Heading, Text, PageTitle } from '@/components/Text'
import { GoalCard } from '@/features/goals/GoalCard'
import { useIdentity } from '@/identity/context'
import { retryRead } from '@/lib/retry'
import { useProfile } from '@/profile/context'
import { useGetCoinHistoryQuery } from '@/store/coins'
import { useListGoalsQuery } from '@/store/goals'
import { entryMeta, formatAmount, mergeNewest } from './utils'

const Total = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 18px;
  border-radius: ${({ theme }) => theme.radiusCard}px;
  background-color: ${({ theme }) => theme.colors.coinBg};
`

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.surface};
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
`

// Цели ребёнка под балансом: сколько накоплено до каждой; нажатие открывает цель с кнопкой «Оплатить»
function GoalsList({ balance, memberId }: { balance: number; memberId: string }) {
  const { data } = useListGoalsQuery(memberId)
  const goals = data?.goals
  if (!goals?.length) return null
  return (
    <View style={{ gap: 10 }}>
      <Heading>Мои цели</Heading>
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} balance={balance} />
      ))}
    </View>
  )
}

// Баланс и история монет ребёнка: свежее сверху, старые записи подгружаются по мере прокрутки.
// Ребёнок видит свои монеты, родитель монеты выбранного ребёнка (memberId).
export function CoinsScreen({ memberId }: { memberId?: string }) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const token = identity?.token
  const isChild = identity?.role === 'child'
  const isAdult = !!identity && !isChild
  // чьи монеты смотрим: свои (ребёнок) или выбранного ребёнка (взрослый)
  const ownerId = isChild ? undefined : memberId
  const canView = isChild || (isAdult && !!memberId)

  // Свежая первая страница из кэша; начисления сбрасывают кэш (сигнал `members`), новая запись встаёт сверху сама.
  const first = useGetCoinHistoryQuery(ownerId ?? '', { skip: !canView })
  const firstPage = first.data

  const [history, setHistory] = useState<{ items: CoinEntry[]; hasMore: boolean; balance: number } | undefined>(() => firstPage)
  const items = history?.items
  const hasMore = history?.hasMore ?? false
  const balance = history?.balance
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailed, setFailed] = useState(false)
  // защита от двойной подгрузки: список может позвать её несколько раз, пока идёт запрос
  const busy = useRef(false)

  useEffect(() => {
    if (!firstPage) return
    setHistory((current) => ({
      ...mergeNewest(current?.items ?? [], firstPage.items, firstPage.hasMore, current?.hasMore ?? false),
      balance: firstPage.balance,
    }))
    setFailed(false)
  }, [firstPage])
  const failed = moreFailed || (first.isError && !history)

  const loadMore = useCallback(async () => {
    if (!token || !items?.length || busy.current) return
    busy.current = true
    setLoadingMore(true)
    try {
      const page = await retryRead(() => listCoinHistory(token, items[items.length - 1].id, ownerId))
      setHistory((current) => {
        const known = current?.items ?? []
        return { items: [...known, ...page.items.filter((e) => !known.some((k) => k.id === e.id))], hasMore: page.hasMore, balance: page.balance }
      })
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      busy.current = false
      setLoadingMore(false)
    }
  }, [token, items, ownerId])

  // монеты есть только у детей; взрослому нужен выбранный ребёнок
  if (identity && !canView) return <Redirect href="/" />
  if (!identity) return null
  const members = data?.members ?? []
  const owner = members.find((m) => m.id === memberId)
  const shown = balance ?? data?.me.coins ?? 0

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      {isChild ? <BackLink fallback="/">← Мой день</BackLink> : <BackLink fallback={{ pathname: '/family/[memberId]', params: { memberId: memberId! } }}>{`← ${owner?.name ?? 'Назад'}`}</BackLink>}
      <PageTitle>{isChild || !owner ? 'Монеты' : `Монеты: ${owner.name}`}</PageTitle>
      <Total accessibilityLiveRegion="polite">
        <CoinIcon size={34} />
        <Text $weight="black" $size={30} style={{ color: colors.coinText }}>
          {String(shown)}
        </Text>
        <Text style={{ color: colors.coinText }}>сейчас на счёте</Text>
      </Total>
      {/* цели видит и оплачивает сам ребёнок */}
      {isChild && <GoalsList balance={shown} memberId={identity.memberId} />}
      <Heading>История</Heading>
      {failed && !items && <Notice tone="error">Не удалось загрузить историю. Проверьте соединение.</Notice>}
      {!items && !failed && <Text $tone="muted">Загрузка…</Text>}
      {items && items.length === 0 && <Notice>Пока нет ни одного начисления.</Notice>}
    </View>
  )

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={header}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + TOP_CORNER, paddingBottom: 120, gap: 8 }}
      renderItem={({ item: entry }) => (
        <Row>
          <View style={{ flex: 1 }}>
            <Text $weight="extraBold" $tone={entry.reason === '' ? 'muted' : 'default'}>
              {entry.reason || 'Без описания'}
            </Text>
            <Text $size={13} $tone="muted">
              {entryMeta(entry, members, identity.role)}
            </Text>
          </View>
          <Text
            $weight="black"
            $size={17}
            accessibilityLabel={`${entry.amount > 0 ? 'Начислено' : 'Списано'}: ${Math.abs(entry.amount)}`}
            style={{ color: entry.amount < 0 ? colors.error : colors.success }}
          >
            {formatAmount(entry.amount)}
          </Text>
        </Row>
      )}
      onEndReached={() => hasMore && !failed && void loadMore()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        <View style={{ gap: 8 }}>
          {failed && items && (
            <Notice tone="error">Не удалось загрузить ещё.</Notice>
          )}
          {failed && items && (
            <Button variant="text" onPress={() => void loadMore()}>
              Повторить
            </Button>
          )}
          {hasMore && !failed && (
            <Button variant="text" disabled={loadingMore} onPress={() => void loadMore()}>
              {loadingMore ? 'Загрузка…' : 'Показать ещё'}
            </Button>
          )}
        </View>
      }
    />
  )
}
