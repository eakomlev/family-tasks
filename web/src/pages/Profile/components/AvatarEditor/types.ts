export interface AvatarEditorProps {
  name: string
  seed: string
  avatar?: string | null
  busy: boolean
  error?: string
  onPick: (file: File) => void
  onRemove: () => void
  // только у детей: взять аватар из Roblox по нику (бросает ошибку, если не вышло)
  onRoblox?: (username: string) => Promise<void>
}
