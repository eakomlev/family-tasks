import { beforeEach, describe, expect, it } from 'vitest'
import { loadTasksView, parseTasksView, resetTasksViewCache, updateTasksView } from '@/features/tasks/viewState'

describe('parseTasksView', () => {
  it('без записи и при порче: завершённые скрыты, все', () => {
    expect(parseTasksView(null)).toEqual({ showDone: false, filter: null })
    expect(parseTasksView('{не json')).toEqual({ showDone: false, filter: null })
  })

  it('читает показ завершённых и фильтр', () => {
    expect(parseTasksView('{"showDone":true,"filter":"m1"}')).toEqual({ showDone: true, filter: 'm1' })
  })

  it('прежняя запись со вкладкой и неизвестные значения заменяются умолчаниями', () => {
    expect(parseTasksView('{"tab":"done","filter":"m1"}')).toEqual({ showDone: false, filter: 'm1' })
    expect(parseTasksView('{"showDone":"yes","filter":7}')).toEqual({ showDone: false, filter: null })
  })
})

describe('updateTasksView', () => {
  beforeEach(() => resetTasksViewCache())

  it('сохраняет изменения на устройстве и не трогает остальные поля', () => {
    updateTasksView('m1', { filter: 'm2' })
    updateTasksView('m1', { showDone: true })
    resetTasksViewCache()
    expect(loadTasksView('m1')).toEqual({ showDone: true, filter: 'm2' })
  })
})
