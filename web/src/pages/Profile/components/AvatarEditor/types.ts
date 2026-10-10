export interface AvatarEditorProps {
  name: string
  seed: string
  avatar?: string | null
  busy: boolean
  error?: string
  onPick: (file: File) => void
  onRemove: () => void
}
