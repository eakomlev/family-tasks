import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RealtimeProvider } from '@/realtime'
import { useLive } from '@/realtime/context'
import type { RealtimeEvent, Topic } from '@/realtime/types'

// подставной WebSocket: тест сам «открывает», присылает сообщения и закрывает
class FakeSocket {
  static all: FakeSocket[] = []
  sent: string[] = []
  closedByClient = false
  onopen?: () => void
  onmessage?: (e: { data: unknown }) => void
  onclose?: (e: { code: number }) => void

  url: string

  constructor(url: string) {
    this.url = url
    FakeSocket.all.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closedByClient = true
    this.onclose?.({ code: 1000 })
  }
  open() {
    this.onopen?.()
  }
  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
  drop(code = 1006) {
    this.onclose?.({ code })
  }
}
const last = () => FakeSocket.all[FakeSocket.all.length - 1]

function Listener({ topics, onEvent }: { topics: Topic[]; onEvent: (e: RealtimeEvent) => void }) {
  useLive(topics, onEvent)
  return null
}

function mount(token = 'tok') {
  const tasks = vi.fn()
  const schedule = vi.fn()
  const view = render(
    <RealtimeProvider token={token}>
      <Listener topics={['tasks']} onEvent={tasks} />
      <Listener topics={['schedule']} onEvent={schedule} />
    </RealtimeProvider>,
  )
  return { tasks, schedule, ...view }
}

beforeEach(() => {
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('RealtimeProvider', () => {
  it('подключается к /api/ws и первым сообщением отправляет токен (не в адресе)', () => {
    mount('секретный-токен')
    expect(FakeSocket.all).toHaveLength(1)
    expect(last().url).toBe(`ws://${window.location.host}/api/ws`)
    expect(last().url).not.toContain('секретный')
    last().open()
    expect(last().sent).toEqual([JSON.stringify({ type: 'auth', token: 'секретный-токен' })])
  })

  it('события получают только подписанные на эту тему', () => {
    const { tasks, schedule } = mount()
    last().open()
    last().receive({ type: 'ready' })
    last().receive({ type: 'tasks' })
    expect(tasks).toHaveBeenCalledWith({ type: 'tasks' })
    expect(schedule).not.toHaveBeenCalled()
    last().receive({ type: 'schedule', memberId: 'm1' })
    expect(schedule).toHaveBeenCalledWith({ type: 'schedule', memberId: 'm1' })
    expect(tasks).toHaveBeenCalledTimes(1)
  })

  it('ready событием для страниц не становится, мусор игнорируется', () => {
    const { tasks } = mount()
    last().open()
    last().receive({ type: 'ready' })
    last().receive({ type: 'что-то' })
    last().onmessage?.({ data: 'не json' })
    expect(tasks).not.toHaveBeenCalled()
  })

  it('после обрыва переподключается с нарастающей паузой и просит обновить всё (resync)', () => {
    const { tasks, schedule } = mount()
    last().open()
    last().receive({ type: 'ready' })
    expect(tasks).not.toHaveBeenCalled() // первое подключение не resync

    last().drop()
    expect(FakeSocket.all).toHaveLength(1)
    act(() => void vi.advanceTimersByTime(1500)) // первая пауза 0.75–1.25 с
    expect(FakeSocket.all).toHaveLength(2)

    last().drop() // второе подключение не удалось: следующая пауза длиннее
    act(() => void vi.advanceTimersByTime(1000))
    expect(FakeSocket.all).toHaveLength(2)
    act(() => void vi.advanceTimersByTime(2000))
    expect(FakeSocket.all).toHaveLength(3)

    last().open()
    last().receive({ type: 'ready' })
    expect(tasks).toHaveBeenCalledWith({ type: 'resync' })
    expect(schedule).toHaveBeenCalledWith({ type: 'resync' })
  })

  it('сессия закрыта сервером (4401): не переподключаемся', () => {
    mount()
    last().open()
    last().drop(4401)
    act(() => void vi.advanceTimersByTime(120_000))
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('при размонтировании соединение закрывается и повторов нет', () => {
    const { unmount } = mount()
    const socket = last()
    socket.open()
    unmount()
    expect(socket.closedByClient).toBe(true)
    act(() => void vi.advanceTimersByTime(120_000))
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('смена токена открывает новое соединение, старое закрывается', () => {
    const { rerender } = mount('a')
    const first = last()
    rerender(<RealtimeProvider token="b"><Listener topics={['tasks']} onEvent={() => {}} /></RealtimeProvider>)
    expect(first.closedByClient).toBe(true)
    expect(FakeSocket.all).toHaveLength(2)
    last().open()
    expect(last().sent[0]).toContain('"token":"b"')
  })

  it('вкладка вернулась после долгого отсутствия: обновить всё; быстрое переключение не в счёт', () => {
    const { tasks } = mount()
    last().open()
    last().receive({ type: 'ready' })
    const visibility = vi.spyOn(document, 'visibilityState', 'get')

    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(1000)
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(tasks).not.toHaveBeenCalled()

    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(10_000)
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(tasks).toHaveBeenCalledWith({ type: 'resync' })
  })

  it('вернулась сеть: подключаемся сразу, не дожидаясь паузы', () => {
    mount()
    last().open()
    last().drop()
    expect(FakeSocket.all).toHaveLength(1)
    window.dispatchEvent(new Event('online'))
    expect(FakeSocket.all).toHaveLength(2)
  })
})

describe('useLive без провайдера', () => {
  it('ничего не делает и не падает', () => {
    const onEvent = vi.fn()
    expect(() => render(<Listener topics={['tasks']} onEvent={onEvent} />)).not.toThrow()
    expect(onEvent).not.toHaveBeenCalled()
  })
})
