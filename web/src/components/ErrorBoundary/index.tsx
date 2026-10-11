import { Component, type ErrorInfo, type ReactNode } from 'react'
import { resetApp } from '@/lib/resetApp'
import { Box } from './styles'

interface State {
  error?: Error
}

// Если интерфейс упал при отрисовке, вместо белого экрана показываем причину и кнопку сброса.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <Box role="alert">
        <h1>Что-то пошло не так</h1>
        <p>Приложение не смогло показать страницу. Обычно помогает сброс: вход на этом устройстве сохранится.</p>
        <button type="button" onClick={() => void resetApp()}>Сбросить и перезагрузить</button>
        <details>
          <summary>Подробности</summary>
          <pre>{error.message}</pre>
        </details>
      </Box>
    )
  }
}
