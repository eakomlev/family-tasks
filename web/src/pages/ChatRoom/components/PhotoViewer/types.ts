import type { ChatMedia } from '@/api'

export interface PhotoViewerProps {
  photos: ChatMedia[]
  // какое фото открыто
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}
