import { useState } from 'react'
import { EMOJI_CATEGORIES } from './emoji'
import { Cell, Grid, Panel, TabButton, Tabs } from './styles'

interface Props {
  recent: string[]
  onPick: (emoji: string) => void
  onBackspace: () => void
}

// Панель эмодзи под полем ввода: «Недавние» и категории; выбор вставляется по курсору, ⌫ стирает целый эмодзи.
export function EmojiPanel({ recent, onPick, onBackspace }: Props) {
  const categories = recent.length > 0 ? [{ key: 'recent', icon: '🕘', title: 'Недавние', items: recent }, ...EMOJI_CATEGORIES] : EMOJI_CATEGORIES
  const [key, setKey] = useState(categories[0].key)
  const current = categories.find((c) => c.key === key) ?? categories[0]

  return (
    <Panel aria-label="Эмодзи">
      <Tabs role="tablist">
        {categories.map((c) => (
          <TabButton key={c.key} type="button" role="tab" aria-selected={c.key === current.key} aria-label={c.title} $active={c.key === current.key} onClick={() => setKey(c.key)}>
            {c.icon}
          </TabButton>
        ))}
        <TabButton type="button" aria-label="Стереть" onClick={onBackspace}>
          ⌫
        </TabButton>
      </Tabs>
      <Grid>
        {current.items.map((emoji) => (
          <Cell key={emoji} type="button" aria-label={emoji} onClick={() => onPick(emoji)}>
            {emoji}
          </Cell>
        ))}
      </Grid>
    </Panel>
  )
}
