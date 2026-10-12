import { useMemo } from 'react'
import { useStore } from 'react-redux'
import { useLive } from '@/realtime/context'
import type { Topic } from '@/realtime/types'
import { api } from './api'
import { createInvalidator, tagsForEvent } from './invalidate'
import type { AppStore } from './index'

const TOPICS: Topic[] = ['tasks', 'members', 'schedule', 'trainings', 'goals', 'chat', 'resync']

// События сокета сбрасывают кэш по тегам. Пока экраны не переехали на RTK Query (фазы 1-5), рядом работают прежние подписки useLive.
export function RealtimeBridge() {
  const store = useStore() as AppStore
  const invalidate = useMemo(() => createInvalidator((tags) => store.dispatch(api.util.invalidateTags(tags))), [store])
  useLive(TOPICS, (event) => invalidate(tagsForEvent(event)))
  return null
}
