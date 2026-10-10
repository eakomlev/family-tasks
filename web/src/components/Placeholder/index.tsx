import { Page } from '@/components/Page'
import { Empty, Emoji } from './styles'
import type { PlaceholderProps } from './types'

// заглушка раздела, который ещё не сделан
export function Placeholder({ title, icon, text }: PlaceholderProps) {
  return (
    <Page>
      <h1>{title}</h1>
      <Empty>
        <Emoji aria-hidden>{icon}</Emoji>
        <p>{text}</p>
      </Empty>
    </Page>
  )
}
