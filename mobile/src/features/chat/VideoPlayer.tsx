import { Modal, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ChatVideo } from '@/api'

// Просмотр видео на весь экран: плеер системы (перемотка, звук, во весь экран), играет сразу. Видео отдаётся частями,
// поэтому начинает играть, не дожидаясь конца загрузки. Закрывается крестиком и кнопкой «назад».
export function VideoPlayer({ video, onClose }: { video: ChatVideo; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const player = useVideoPlayer(video.url, (p) => {
    p.play()
  })

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center' }}>
        <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
          hitSlop={10}
          style={{ position: 'absolute', top: insets.top + 12, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={24} color="#ffffff" />
        </Pressable>
      </View>
    </Modal>
  )
}
