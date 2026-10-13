import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import { LessonViewList } from '@/components/LessonViewList'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import LessonReport from '@/pages/LessonReport'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), sendMessage: vi.fn() }))

function renderPage(url: string, role: Identity['role'] = 'child') {
  const identity: Identity = { familyCode: 'c', memberId: 'kid', name: 'Миша', role, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/lesson-report" element={<LessonReport />} />
            <Route path="/chat/:chat" element={<p>Общий чат открыт</p>} />
            <Route path="/my-day" element={<p>Мой день</p>} />
          </Routes>
        </MemoryRouter>
      </IdentityContext.Provider>
    </Provider>,
  )
  return userEvent.setup()
}

const send = () => screen.getByRole('button', { name: 'Отправить в общий чат' })

beforeEach(() => {
  setSession({ token: 'tok', memberId: 'kid' })
  vi.mocked(api.sendMessage).mockReset().mockResolvedValue({
    message: { id: 'x', senderId: 'kid', text: '', caption: '', media: [], createdAt: '2026-10-11T10:00:00Z', reactions: [], awards: [] },
  })
})

describe('«Что ты хочешь сообщить!»', () => {
  const url = '/lesson-report?subject=' + encodeURIComponent('Математика')

  it('заголовок, урок и оценки от пятёрки к двойке; отправить нельзя, пока ничего не выбрано', () => {
    renderPage(url)
    expect(screen.getByRole('heading', { name: 'Что ты хочешь сообщить!' })).toBeInTheDocument()
    expect(screen.getByText('Урок «Математика»')).toBeInTheDocument()
    const grades = screen.getAllByRole('button').filter((b) => /^[2-5]$/.test(b.textContent ?? '')).map((b) => b.textContent)
    expect(grades).toEqual(['5', '4', '3', '2'])
    expect(send()).toBeDisabled()
  })

  it('только оценка: в общий чат уходит сообщение с оценкой, затем открывается общий чат', async () => {
    const user = renderPage(url)
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(send())
    expect(api.sendMessage).toHaveBeenCalledWith('tok', 'family', 'Урок «Математика»: оценка 5')
    expect(await screen.findByText('Общий чат открыт')).toBeInTheDocument()
  })

  it('оценка и сообщение: две строки', async () => {
    const user = renderPage(url)
    await user.click(screen.getByRole('button', { name: '4' }))
    await user.type(screen.getByLabelText(/^Сообщение/), 'Сдал контрольную')
    await user.click(send())
    expect(api.sendMessage).toHaveBeenCalledWith('tok', 'family', 'Урок «Математика»: оценка 4\nСдал контрольную')
  })

  it('только сообщение, без оценки', async () => {
    const user = renderPage(url)
    await user.type(screen.getByLabelText(/^Сообщение/), 'Было интересно')
    await user.click(send())
    expect(api.sendMessage).toHaveBeenCalledWith('tok', 'family', 'Урок «Математика»\nБыло интересно')
  })

  it('выбрана только одна оценка; повторное нажатие снимает выбор', async () => {
    const user = renderPage(url)
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '3' }))
    expect(send()).toBeDisabled()
  })

  it('ошибка отправки: остаёмся на странице, можно повторить', async () => {
    vi.mocked(api.sendMessage).mockRejectedValueOnce(new api.ApiError(0, 'network'))
    const user = renderPage(url)
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(send())
    expect(await screen.findByText(/Не удалось отправить/)).toBeInTheDocument()
    await waitFor(() => expect(send()).toBeEnabled())
    await user.click(send())
    expect(await screen.findByText('Общий чат открыт')).toBeInTheDocument()
  })

  it('родителю и без урока страница не нужна: возврат на «Мой день»', () => {
    renderPage(url, 'mama')
    expect(screen.getByText('Мой день')).toBeInTheDocument()
  })

  it('без названия урока тоже возврат', () => {
    renderPage('/lesson-report')
    expect(screen.getByText('Мой день')).toBeInTheDocument()
  })

  it('название с кавычками и спецсимволами доходит целым', async () => {
    const user = renderPage('/lesson-report?subject=' + encodeURIComponent('Литература & чтение'))
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(send())
    expect(api.sendMessage).toHaveBeenCalledWith('tok', 'family', 'Урок «Литература & чтение»: оценка 5')
  })
})

describe('уроки со ссылками', () => {
  const lessons = [
    { key: 'a', subject: 'Математика', startsAt: '08:30', endsAt: '09:15' },
    { key: 'b', subject: 'Русский язык', startsAt: null, endsAt: null },
  ]

  it('с getLink каждый урок ссылка', () => {
    render(
      <MemoryRouter>
        <LessonViewList lessons={lessons} getLink={(l) => `/lesson-report?subject=${encodeURIComponent(l.subject)}`} />
      </MemoryRouter>,
    )
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/lesson-report?subject=%D0%9C%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0')
    expect(links[0]).toHaveTextContent('Математика')
    expect(links[0]).toHaveTextContent('08:30–09:15')
  })

  it('без getLink уроки обычный текст, как в расписании', () => {
    render(<MemoryRouter><LessonViewList lessons={lessons} /></MemoryRouter>)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Математика')).toBeInTheDocument()
  })
})
