import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Member } from '@/api'
import { IdentityContext } from '@/identity/context'
import { TodayTasks } from '@/pages/MyDay/components/TodayTasks'
import { ProfileContext } from '@/profile/context'
import { occ, task } from '../helpers'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api')>()), listTasks: vi.fn() }))

const members: Member[] = [
  { id: 'me', name: 'Миша', role: 'child', avatar: null, isOwner: false },
  { id: 'other', name: 'Аня', role: 'child', avatar: null, isOwner: false },
]
const NOW = new Date(2026, 9, 11, 10)

function renderBlock(role: 'child' | 'mama' = 'child') {
  const identity = { familyCode: 'c', memberId: 'me', name: 'Миша', role, token: 'tok' }
  return render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'x@y.z' }, members }, failed: false, refresh: async () => {} }}>
        <MemoryRouter><TodayTasks now={NOW} /></MemoryRouter>
      </ProfileContext.Provider>
    </IdentityContext.Provider>,
  )
}

const t = (id: string, title: string, assigneeId = 'me', time: string | null = null) => task({ id, title, assigneeId, time })

beforeEach(() => vi.mocked(api.listTasks).mockReset())

describe('TodayTasks: мои задания', () => {
  it('просроченные, потом сегодняшние по времени, потом отдельной группой «Без срока»; будущие и чужие не показываются', async () => {
    vi.mocked(api.listTasks).mockResolvedValue({
      tasks: [
        t('late', 'Просроченное'),
        t('eve', 'Вечернее', 'me', '20:00'),
        t('morn', 'Утреннее', 'me', '08:00'),
        t('none', 'Без даты'),
        t('future', 'Завтрашнее'),
        t('foreign', 'Чужое без срока', 'other'),
        t('foreignToday', 'Чужое сегодня', 'other'),
      ],
      occurrences: [
        occ('none', null),
        occ('eve', '2026-10-11'),
        occ('future', '2026-10-12'),
        occ('late', '2026-10-09'),
        occ('morn', '2026-10-11'),
        occ('foreign', null),
        occ('foreignToday', '2026-10-11'),
      ],
    })
    renderBlock()
    await screen.findByText('Просроченное')

    const titles = screen.getAllByRole('link').map((l) => l.textContent ?? '')
    const order = ['Просроченное', 'Утреннее', 'Вечернее', 'Без даты'].map((name) => titles.findIndex((x) => x.includes(name)))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)

    expect(screen.getByText('Без срока')).toBeInTheDocument()
    expect(screen.queryByText('Завтрашнее')).not.toBeInTheDocument()
    expect(screen.queryByText('Чужое без срока')).not.toBeInTheDocument()
    expect(screen.queryByText('Чужое сегодня')).not.toBeInTheDocument()
  })

  it('есть только задания без срока: блок не пустой, группа подписана', async () => {
    vi.mocked(api.listTasks).mockResolvedValue({ tasks: [t('none', 'Разобрать полку')], occurrences: [occ('none', null)] })
    renderBlock()
    expect(await screen.findByText('Разобрать полку')).toBeInTheDocument()
    expect(screen.getByText('Без срока')).toBeInTheDocument()
    expect(screen.queryByText(/заданий на сегодня и без срока нет/i)).not.toBeInTheDocument()
  })

  it('без единого задания: подсказка', async () => {
    vi.mocked(api.listTasks).mockResolvedValue({ tasks: [], occurrences: [] })
    renderBlock()
    expect(await screen.findByText('Заданий на сегодня и без срока нет.')).toBeInTheDocument()
    expect(screen.queryByText('Без срока')).not.toBeInTheDocument()
  })
})

describe('TodayTasks: выполненные задания', () => {
  const list = () => ({
    tasks: [t('open', 'Открытое'), t('done', 'Сделанное'), t('wait', 'На проверке'), t('late', 'Вчерашнее сделанное')],
    occurrences: [occ('open', '2026-10-11'), occ('done', '2026-10-11', true), occ('wait', '2026-10-11', false, true), occ('late', '2026-10-09', true)],
  })

  it('у ребёнка выполненные не показываются, а открытые и ожидающие проверки остаются', async () => {
    vi.mocked(api.listTasks).mockResolvedValue(list())
    renderBlock('child')
    await screen.findByText('Открытое')
    expect(screen.getByText('На проверке')).toBeInTheDocument()
    expect(screen.queryByText('Сделанное')).not.toBeInTheDocument()
    expect(screen.queryByText('Вчерашнее сделанное')).not.toBeInTheDocument()
  })

  it('ребёнок сделал всё: вместо списка «Все задания на сегодня выполнены»', async () => {
    vi.mocked(api.listTasks).mockResolvedValue({ tasks: [t('done', 'Сделанное')], occurrences: [occ('done', '2026-10-11', true)] })
    renderBlock('child')
    expect(await screen.findByText('Все задания на сегодня выполнены.')).toBeInTheDocument()
    expect(screen.queryByText('Сделанное')).not.toBeInTheDocument()
  })

  it('заданий не было вовсе: прежняя подсказка', async () => {
    vi.mocked(api.listTasks).mockResolvedValue({ tasks: [], occurrences: [] })
    renderBlock('child')
    expect(await screen.findByText('Заданий на сегодня и без срока нет.')).toBeInTheDocument()
  })

  it('у родителя свои выполненные остаются в списке', async () => {
    vi.mocked(api.listTasks).mockResolvedValue(list())
    renderBlock('mama')
    expect(await screen.findByText('Сделанное')).toBeInTheDocument()
  })
})
