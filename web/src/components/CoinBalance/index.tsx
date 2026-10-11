import { Card, CardLabel, CardValue, Chevron, Chip, Coin } from './styles'

// Монета: золотой кружок с ободком и звездой. Рисунок цветной (монета остаётся монетой в любой теме).
export function CoinIcon() {
  return (
    <Coin viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="10" fill="#fbbf24" stroke="#d97706" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="#d97706" strokeWidth="1.1" opacity="0.7" />
      <path d="m12 8.2 1.15 2.45 2.65.35-1.95 1.85.5 2.65L12 14.2l-2.35 1.3.5-2.65-1.95-1.85 2.65-.35z" fill="#d97706" />
    </Coin>
  )
}

// Баланс виртуальных монет ребёнка: монета и число; по нажатию открывается история начислений.
// Отрицательный баланс тоже показывается как есть.
export function CoinBalance({ coins }: { coins: number }) {
  return (
    <Chip to="/coins" aria-label={`Монеты: ${coins}. Открыть историю`}>
      <CoinIcon />
      <span>{coins}</span>
    </Chip>
  )
}

// Строка с балансом для профиля ребёнка: монета, подпись, число и стрелка; ведёт на страницу истории начислений.
export function CoinBalanceCard({ coins, to }: { coins: number; to: string }) {
  return (
    <Card to={to} aria-label={`Монеты: ${coins}. Открыть историю`}>
      <CoinIcon />
      <CardLabel>Монеты</CardLabel>
      <CardValue>{coins}</CardValue>
      <Chevron aria-hidden>›</Chevron>
    </Card>
  )
}
