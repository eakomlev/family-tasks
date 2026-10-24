import { beforeEach, describe, expect, it } from 'vitest'
import { loadTasksView, parseTasksView, saveTasksView } from '@/lib/tasksView'

describe('показ завершённых заданий', () => {
  beforeEach(() => localStorage.clear())

  it('без записи и при порче завершённые скрыты', () => {
    expect(parseTasksView(null)).toEqual({ showDone: false })
    expect(parseTasksView('{не json')).toEqual({ showDone: false })
    expect(parseTasksView('{"showDone":"yes"}')).toEqual({ showDone: false })
  })

  it('запоминается на устройстве отдельно для каждого участника', () => {
    saveTasksView('m1', { showDone: true })
    expect(loadTasksView('m1')).toEqual({ showDone: true })
    expect(loadTasksView('m2')).toEqual({ showDone: false })
    expect(loadTasksView(undefined)).toEqual({ showDone: false })
  })
})
