import { describe, expect, it } from 'vitest'
import { parseTasksView } from '@/features/tasks/viewState'

describe('parseTasksView', () => {
  it('без записи и при порче: «Предстоящие» и все', () => {
    expect(parseTasksView(null)).toEqual({ tab: 'upcoming', filter: null })
    expect(parseTasksView('{не json')).toEqual({ tab: 'upcoming', filter: null })
  })

  it('читает вкладку и фильтр', () => {
    expect(parseTasksView('{"tab":"done","filter":"m1"}')).toEqual({ tab: 'done', filter: 'm1' })
  })

  it('неизвестные значения заменяет умолчаниями', () => {
    expect(parseTasksView('{"tab":5,"filter":7}')).toEqual({ tab: 'upcoming', filter: null })
  })
})
