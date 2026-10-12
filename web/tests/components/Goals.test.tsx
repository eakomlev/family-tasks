import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Goal, Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { GoalCard } from '@/components/GoalCard'
import { IdentityContext } from '@/identity/context'
import { ProfileContext } from '@/profile/context'
import GoalView from '@/pages/GoalView'
import { emptyGoalForm, validateGoal } from '@/pages/GoalForm/utils'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  getGoal: vi.fn(),
  purchaseGoal: vi.fn(),
  deleteGoal: vi.fn(),
}))

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  memberId: 'kid',
  title: 'Набор лего',
  price: 300,
  url: 'https://shop.example/lego',
  image: null,
  createdAt: '2026-10-11T10:00:00.000Z',
  purchasedAt: null,
  ...over,
})

const mom: Member = { id: 'mom', name: 'Лена', role: 'mama', avatar: null, isOwner: true }
const kid: Member = { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false }

function renderView(me: Member, loaded: { goal: Goal; balance: number }) {
  vi.mocked(api.getGoal).mockResolvedValue(loaded)
  const identity = { familyCode: 'c', memberId: me.id, name: me.name, role: me.role, token: 'tok' }
  render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members: [mom, kid] }, failed: false, refresh: async () => {} }}>
        <ConfirmProvider>
          <MemoryRouter initialEntries={['/goals/g1']}>
            <Routes>
              <Route path="/goals/:goalId" element={<GoalView />} />
              <Route path="/goals/:goalId/edit" element={<p>Форма изменения</p>} />
              <Route path="/coins" element={<p>Монеты</p>} />
              <Route path="/family/:memberId/goals" element={<p>Список целей</p>} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
}

beforeEach(() => {
  vi.mocked(api.getGoal).mockReset()
  vi.mocked(api.purchaseGoal).mockReset()
  vi.mocked(api.deleteGoal).mockReset().mockResolvedValue(undefined)
})

describe('validateGoal', () => {
  const ok = { ...emptyGoalForm(), title: 'Лего', price: '300' }

  it('верная форма без ссылки и со ссылкой', () => {
    expect(validateGoal(ok)).toBeNull()
    expect(validateGoal({ ...ok, url: 'https://a.example/x' })).toBeNull()
  })

  it('название, цена и ссылка проверяются', () => {
    expect(validateGoal({ ...ok, title: '  ' })).toMatch(/название/i)
    for (const price of ['', '0', '1.5', 'abc', '100001']) expect(validateGoal({ ...ok, price })).toMatch(/Цена/)
    expect(validateGoal({ ...ok, url: 'javascript:alert(1)' })).toMatch(/Ссылка/)
  })
})

describe('GoalCard', () => {
  const renderCard = (g: Goal, balance?: number) => render(<MemoryRouter><ul><GoalCard goal={g} balance={balance} /></ul></MemoryRouter>)

  it('ведёт на страницу цели, без картинки заглушка, у купленной бейдж', () => {
    renderCard(goal({ purchasedAt: '2026-10-12T10:00:00Z' }))
    expect(screen.getByRole('link', { name: /Набор лего/ })).toHaveAttribute('href', '/goals/g1')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Куплено')).toBeInTheDocument()
  })

  it('с картинкой показывает её; накопленное видно только у не купленной', () => {
    renderCard(goal({ image: 'data:image/png;base64,AAAA' }), 120)
    expect(document.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    expect(screen.getByRole('img', { name: 'Накоплено 120 из 300' })).toBeInTheDocument()
  })
})

describe('страница цели у ребёнка', () => {
  it('не хватает монет: написано сколько, оплатить нельзя', async () => {
    renderView(kid, { goal: goal(), balance: 120 })
    expect(await screen.findByText(/Не хватает 180 монет/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Оплатить: 300' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'https://shop.example/lego' })).toHaveAttribute('target', '_blank')
  })

  it('хватает: подтверждение, оплата, цель становится купленной', async () => {
    renderView(kid, { goal: goal(), balance: 500 })
    const user = userEvent.setup()
    vi.mocked(api.purchaseGoal).mockResolvedValue({ goal: goal({ purchasedAt: '2026-10-12T10:00:00Z' }), balance: 200 })
    await user.click(await screen.findByRole('button', { name: 'Оплатить: 300' }))
    // окно подтверждения
    await user.click(await screen.findByRole('button', { name: 'Оплатить' }))
    await waitFor(() => expect(api.purchaseGoal).toHaveBeenCalledWith('tok', 'g1'))
    expect(await screen.findByText(/Куплено/, { selector: 'p, div' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Оплатить/ })).not.toBeInTheDocument()
  })

  it('отказ в подтверждении ничего не списывает', async () => {
    renderView(kid, { goal: goal(), balance: 500 })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Оплатить: 300' }))
    await user.click(await screen.findByRole('button', { name: 'Отмена' }))
    expect(api.purchaseGoal).not.toHaveBeenCalled()
  })
})

describe('страница цели у родителя', () => {
  it('«Изменить» и «Удалить» есть, оплаты нет; у купленной нет «Изменить»', async () => {
    renderView(mom, { goal: goal(), balance: 500 })
    expect(await screen.findByRole('button', { name: 'Изменить' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Удалить цель' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Оплатить/ })).not.toBeInTheDocument()
  })

  it('купленную можно только удалить', async () => {
    renderView(mom, { goal: goal({ purchasedAt: '2026-10-12T10:00:00Z' }), balance: 0 })
    expect(await screen.findByRole('button', { name: 'Удалить цель' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument()
  })
})
