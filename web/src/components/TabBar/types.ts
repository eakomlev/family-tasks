export type TabIconName = 'tasks' | 'chat' | 'day' | 'family' | 'settings'

export interface Tab {
  path: string
  label: string
  icon: TabIconName
}
