import { act, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { TaskList } from '@/api'
import { useToggleOccurrence } from '@/lib/useToggleOccurrence'
import { occ, task } from '../helpers'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  completeTask: vi.fn(),
  uncompleteTask: vi.fn(),
}))

const initial = (): TaskList => ({
  tasks: [task({ id: 'a' })],
  occurrences: [occ('a', '2026-10-11'), occ('a', '2026-10-12')],
})

function setup(options?: { removeWhenUndone?: boolean }, start: TaskList = initial()) {
  return renderHook(() => {
    const [list, setList] = useState<TaskList | undefined>(start)
    return { list: list!, ...useToggleOccurrence('tok', 'me', list, setList, options) }
  })
}

const entry = (list: TaskList, index: number) => ({ task: list.tasks[0], occurrence: list.occurrences[index] })

beforeEach(() => {
  vi.mocked(api.completeTask).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.uncompleteTask).mockReset().mockResolvedValue(undefined)
})

describe('useToggleOccurrence', () => {
  it('отметка применяется сразу и отправляется на сервер для нужного дня', async () => {
    let resolve!: () => void
    vi.mocked(api.completeTask).mockReturnValue(new Promise<void>((r) => (resolve = r)))
    const { result } = setup()

    act(() => void result.current.toggle(entry(result.current.list, 0)))

    // сервер ещё не ответил, а в списке отметка уже есть, и только у первого дня
    expect(result.current.list.occurrences[0].done?.memberId).toBe('me')
    expect(result.current.list.occurrences[1].done).toBeNull()
    expect(result.current.busy).toBe('a|2026-10-11')
    expect(api.completeTask).toHaveBeenCalledWith('tok', 'a', '2026-10-11')

    await act(async () => resolve())
    await waitFor(() => expect(result.current.busy).toBeUndefined())
    expect(result.current.error).toBeUndefined()
  })

  it('снятие отметки вызывает uncomplete', async () => {
    const start = initial()
    start.occurrences[0] = occ('a', '2026-10-11', true)
    const { result } = setup(undefined, start)

    await act(async () => result.current.toggle(entry(result.current.list, 0)))

    expect(api.uncompleteTask).toHaveBeenCalledWith('tok', 'a', '2026-10-11')
    expect(api.completeTask).not.toHaveBeenCalled()
    expect(result.current.list.occurrences[0].done).toBeNull()
  })

  it('при ошибке список возвращается как был и показывается сообщение', async () => {
    vi.mocked(api.completeTask).mockRejectedValue(new api.ApiError(500, 'x'))
    const { result } = setup()
    const before = result.current.list

    await act(async () => result.current.toggle(entry(before, 0)))

    expect(result.current.list).toEqual(before)
    expect(result.current.error).toMatch(/Не удалось изменить отметку/)
    expect(result.current.busy).toBeUndefined()
  })

  it('removeWhenUndone убирает запись из списка «Выполненные»', async () => {
    const start = initial()
    start.occurrences[0] = occ('a', '2026-10-11', true)
    const { result } = setup({ removeWhenUndone: true }, start)

    await act(async () => result.current.toggle(entry(result.current.list, 0)))

    expect(result.current.list.occurrences.map((o) => o.date)).toEqual(['2026-10-12'])
  })

  it('removeWhenUndone при ошибке возвращает запись обратно', async () => {
    vi.mocked(api.uncompleteTask).mockRejectedValue(new api.ApiError(0, 'network'))
    const start = initial()
    start.occurrences[0] = occ('a', '2026-10-11', true)
    const { result } = setup({ removeWhenUndone: true }, start)

    await act(async () => result.current.toggle(entry(result.current.list, 0)))

    expect(result.current.list.occurrences).toHaveLength(2)
  })

  it('без токена или участника ничего не делает', async () => {
    const { result } = renderHook(() => {
      const [list, setList] = useState<TaskList | undefined>(initial())
      return { list: list!, ...useToggleOccurrence(undefined, 'me', list, setList) }
    })
    await act(async () => result.current.toggle(entry(result.current.list, 0)))
    expect(api.completeTask).not.toHaveBeenCalled()
    expect(result.current.list.occurrences[0].done).toBeNull()
  })
})
