// Только для просмотра вёрстки в браузере (`npm run web:preview`): у нативного `react-native-pager-view` нет веб-версии,
// а react-native-web не умеет `codegenNativeCommands`, и всё приложение падало при загрузке. Здесь страницы не листаются пальцем:
// показывается одна текущая, переключать её можно через `setPage` (нажатия на вкладки). На телефоне и в сборках используется настоящий пакет.
import { forwardRef, useImperativeHandle, useState, Children, type ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'

interface Props {
  children?: ReactNode
  style?: ViewStyle
  initialPage?: number
  onPageSelected?: (e: { nativeEvent: { position: number } }) => void
  onPageScroll?: (e: { nativeEvent: { position: number; offset: number } }) => void
}

export interface PagerViewHandle {
  setPage(page: number): void
  setPageWithoutAnimation(page: number): void
}

const PagerView = forwardRef<PagerViewHandle, Props>(function PagerView({ children, style, initialPage = 0, onPageSelected, onPageScroll }, ref) {
  const [page, setPage] = useState(initialPage)

  const go = (next: number, notify: boolean) => {
    setPage(next)
    onPageScroll?.({ nativeEvent: { position: next, offset: 0 } })
    if (notify) onPageSelected?.({ nativeEvent: { position: next } })
  }

  useImperativeHandle(ref, () => ({
    setPage: (next) => go(next, true),
    setPageWithoutAnimation: (next) => go(next, false),
  }))

  const pages = Children.toArray(children)
  return <View style={[{ flex: 1 }, style]}>{pages[page] ?? null}</View>
})

export default PagerView
