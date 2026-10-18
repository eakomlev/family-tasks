import { Screen } from '../Screen'
import { Notice } from '../Notice'
import { Title } from '../Text'

// Заглушка раздела, который ещё не перенесён из веб-версии (см. docs/mobile-app-plan.md, фазы 3–5)
export function Placeholder({ title }: { title: string }) {
  return (
    <Screen bottomReserve={88}>
      <Title>{title}</Title>
      <Notice>Раздел появится в следующих версиях приложения.</Notice>
    </Screen>
  )
}
