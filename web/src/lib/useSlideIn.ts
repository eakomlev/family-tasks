import { useLocation, useNavigationType } from 'react-router-dom'

// Состояние перехода «назад» для ссылок со стрелкой (BackLink, кнопка назад в переписке): страница, на которую вернулись, не выезжает.
export const BACK_STATE = { back: true }

// Выезжать справа нужно только при переходе вперёд. При возврате (кнопка «назад» браузера или жест, ссылка «←») анимации нет:
// страница, на которую возвращаются, уже «позади», и выезд справа выглядит странно.
export function useSlideIn(): boolean {
  const type = useNavigationType()
  const state = useLocation().state as { back?: boolean } | null
  return type !== 'POP' && state?.back !== true
}
