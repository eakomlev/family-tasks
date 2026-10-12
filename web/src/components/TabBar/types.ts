export type TabIconName = 'tasks' | 'chat' | 'day' | 'family'

export interface Tab {
  path: string
  label: string
  icon: TabIconName
}
