import { useMemo } from 'react'
import { useStore } from 'react-redux'
import { useLive } from '@/realtime/context'
import type { Topic } from '@/realtime/types'
import { api } from './api'
import { createInvalidator, tagsForEvent } from './invalidate'
import type { AppStore } from './index'

const TOPICS: Topic[] = ['tasks', 'members', 'schedule', 'trainings', 'goals', 'events', 'chat', 'resync']

// События сокета сбрасывают кэш по тегам: активные экраны сами запрашивают данные заново, неактивные записи удаляются.
// Единственное место, где используется `useLive`: экраны на сигналы не подписываются.
export function RealtimeBridge() {
  const store = useStore() as AppStore
  const invalidate = useMemo(() => createInvalidator((tags) => store.dispatch(api.util.invalidateTags(tags))), [store])
  useLive(TOPICS, (event) => invalidate(tagsForEvent(event)))
  return null
}
