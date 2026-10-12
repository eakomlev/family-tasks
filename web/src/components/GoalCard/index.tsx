import { CoinIcon } from '@/components/CoinBalance'
import { Body, Bought, Card, Chevron, Frame, Price, Progress } from './styles'
import type { GoalCardProps, GoalImageProps } from './types'

// Картинка цели; без неё значок подарка. У купленной на картинке бейдж «Куплено».
export function GoalImage({ goal, large }: GoalImageProps) {
  return (
    <Frame $large={large}>
      {goal.image ? (
        <img src={goal.image} alt={large ? goal.title : ''} />
      ) : (
        <svg viewBox="0 0 24 24" role={large ? 'img' : undefined} aria-label={large ? 'Без картинки' : undefined} aria-hidden={large ? undefined : true}>
          <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
          <path d="M12 7C10 3.5 6.5 4 7 6s3 1 5 1zM12 7c2-3.5 5.5-3 5-1s-3 1-5 1z" />
        </svg>
      )}
      {goal.purchasedAt && <Bought $large={large}>Куплено</Bought>}
    </Frame>
  )
}

// Карточка цели в списке: картинка, название, цена; ведёт на страницу цели.
export function GoalCard({ goal, balance }: GoalCardProps) {
  const bought = goal.purchasedAt !== null
  return (
    <li style={{ listStyle: 'none' }}>
      <Card to={`/goals/${goal.id}`}>
        <GoalImage goal={goal} />
        <Body>
          <strong>{goal.title}</strong>
          <Price>
            <CoinIcon />
            {goal.price}
          </Price>
          {!bought && balance !== undefined && (
            <Progress $ratio={balance / goal.price} role="img" aria-label={`Накоплено ${Math.max(0, Math.min(balance, goal.price))} из ${goal.price}`} />
          )}
        </Body>
        <Chevron aria-hidden>›</Chevron>
      </Card>
    </li>
  )
}
