import { describe, expect, it } from 'vitest'
import { tabBarVisible } from '@/lib/tabBar'

describe('панель табов внизу', () => {
  it.each(['/', '/tasks', '/chat', '/family'])('есть: %s', (path) => {
    expect(tabBarVisible(path)).toBe(true)
  })

  it.each(['/profile', '/profile/edit', '/coins', '/coins/u1', '/goals/g1', '/calendar', '/calendar/events/e1', '/lesson-report', '/chat/family', '/chat/u1/media', '/tasks/abc', '/tasks/new', '/family/invite', '/family/u1', '/family/u1/goals', '/family/delete'])(
    'нет: %s',
    (path) => {
      expect(tabBarVisible(path)).toBe(false)
    },
  )
})
