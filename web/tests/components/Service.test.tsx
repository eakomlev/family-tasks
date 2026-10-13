import { cleanup, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import Profile from '@/pages/Profile'
import Service from '@/pages/Service'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

const me: Member = { id: 'me', name: 'Евгений', role: 'papa', avatar: null, isOwner: true }
const stats = { accounts: { total: 1234, today: 3 }, families: { total: 400, today: 1 }, messages: { total: 56789, today: 120 } }
const queue = {
  notifier: { alive: true, instances: 1, lastBeatSeconds: 3 },
  waiting: { email: 4, push: 17 },
  retrying: 2,
  oldestSeconds: 95,
  mail: { usedToday: 1240, limit: 3000 },
  today: { email: { sent: 80, failed: 0 }, push: { sent: 400, failed: 0 } },
  scheduler: { alive: true, instances: 1, lastBeatSeconds: 5, lastTickSeconds: 42, lastSent: 6, lastError: null },
}
// ответы по адресам: статистика и очередь; остальное ошибка
const serve = (over: { queue?: unknown } = {}) =>
  vi.fn(async (url: string) => {
    if (String(url).startsWith('/api/admin/stats')) return new Response(JSON.stringify(stats))
    if (String(url) === '/api/admin/queue') return new Response(JSON.stringify(over.queue ?? queue))
    return new Response('{}', { status: 500 })
  })

function renderAt(path: string, isAdmin: boolean) {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Евгений', role: 'papa' as const, token: 'tok' }
  return render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...me, email: 'a@b.c', isAdmin }, members: [me] }, failed: false }}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/service" element={<Service />} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => setSession({ token: 'tok', memberId: 'me' }))
afterEach(() => {
  vi.unstubAllGlobals()
  setSession(undefined)
})

describe('раздел «Сервис»', () => {
  it('в профиле ссылка «Сервис» только у администратора', () => {
    renderAt('/profile', true)
    expect(screen.getByRole('link', { name: /Сервис/ })).toHaveAttribute('href', '/profile/service')
  })

  it('у остальных ссылки нет, а страница ведёт обратно в профиль', async () => {
    renderAt('/profile', false)
    expect(screen.queryByRole('link', { name: /Сервис/ })).not.toBeInTheDocument()
    renderAt('/profile/service', false)
    expect(await screen.findAllByRole('heading', { name: 'Профиль' })).not.toHaveLength(0)
  })

  it('администратору показаны аккаунты, семьи и сообщения, всего и за сегодня', async () => {
    const fetchMock = vi.fn(async (url: string) => (String(url).startsWith('/api/admin/stats') ? new Response(JSON.stringify(stats)) : new Response('{}', { status: 500 })))
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/profile/service', true)
    expect(await screen.findByText('1 234')).toBeInTheDocument()
    expect(screen.getByText('56 789')).toBeInTheDocument()
    const accounts = screen.getByRole('region', { name: 'Аккаунты' })
    expect(accounts).toHaveTextContent('Новых сегодня3')
    expect(screen.getByRole('region', { name: 'Сообщения' })).toHaveTextContent('Сегодня120')
    // начало дня уходит параметром: часовой пояс знает клиент
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/api\/admin\/stats\?since=\d{4}-\d{2}-\d{2}T/)
  })

  it('ошибка загрузки показывается, страница не ломается', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    renderAt('/profile/service', true)
    expect(await screen.findByText(/Не удалось загрузить статистику/)).toBeInTheDocument()
  })

  describe('очередь отправки', () => {
    it('показаны числа очереди, расход бюджета и итоги за сегодня; всё в порядке: предупреждений нет', async () => {
      vi.stubGlobal('fetch', serve())
      renderAt('/profile/service', true)
      const region = await screen.findByRole('region', { name: 'Очередь отправки' })
      expect(await within(region).findByText('1 240 из 3 000')).toBeInTheDocument()
      expect(region).toHaveTextContent('Писем ждут4')
      expect(region).toHaveTextContent('Push ждут17')
      expect(region).toHaveTextContent('Ждут повтора2')
      expect(region).toHaveTextContent('Самое старое1 мин')
      expect(region).toHaveTextContent('Сервис отправкиработает')
      expect(region).toHaveTextContent('Отправлено сегодняписьма 80 · push 400')
      expect(region.querySelector('p')).toBeNull()
    })

    it('notifier не отвечает и бюджет исчерпан: два предупреждения', async () => {
      vi.stubGlobal('fetch', serve({
        queue: { ...queue, notifier: { alive: false, instances: 0, lastBeatSeconds: 900 }, mail: { usedToday: 3000, limit: 3000 }, oldestSeconds: 700 },
      }))
      renderAt('/profile/service', true)
      const region = await screen.findByRole('region', { name: 'Очередь отправки' })
      expect(await within(region).findByText(/не отвечает, письма и push копятся/)).toBeInTheDocument()
      expect(region).toHaveTextContent('Дневной лимит писем исчерпан')
      expect(region).toHaveTextContent('Самое старое сообщение ждёт 11 мин')
      expect(region).toHaveTextContent('Сервис отправкине отвечает')
    })

    it('планировщик: состояние, давность прохода и сколько поставлено; у сервера старой версии блока нет', async () => {
      vi.stubGlobal('fetch', serve())
      renderAt('/profile/service', true)
      const region = await screen.findByRole('region', { name: 'Планировщик' })
      expect(region).toHaveTextContent('Состояниеработает')
      expect(region).toHaveTextContent('Последний проход42 с назад')
      expect(region).toHaveTextContent('Поставил в очередь6')
      cleanup()

      const { scheduler: _omit, ...old } = queue
      vi.stubGlobal('fetch', serve({ queue: old }))
      renderAt('/profile/service', true)
      expect(await screen.findByRole('region', { name: 'Очередь отправки' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Планировщик' })).toBeNull()
    })

    it('планировщик не отвечает: предупреждение в очереди и статус в блоке', async () => {
      vi.stubGlobal('fetch', serve({ queue: { ...queue, scheduler: { alive: false, instances: 0, lastBeatSeconds: 700, lastTickSeconds: 700, lastSent: 0, lastError: null } } }))
      renderAt('/profile/service', true)
      const region = await screen.findByRole('region', { name: 'Планировщик' })
      expect(region).toHaveTextContent('Состояниене отвечает')
      expect(await screen.findByText(/Планировщик \(scheduler\) не отвечает/)).toBeInTheDocument()
    })

    it('ошибка загрузки очереди не ломает статистику выше', async () => {
      vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).startsWith('/api/admin/stats') ? new Response(JSON.stringify(stats)) : new Response('{}', { status: 500 }))))
      renderAt('/profile/service', true)
      expect(await screen.findByText('1 234')).toBeInTheDocument()
      expect(await screen.findByText('Не удалось загрузить состояние очереди.')).toBeInTheDocument()
    })
  })
})
