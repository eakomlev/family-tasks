import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { FamilyEvent, Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { TimePicker } from '@/components/TimePicker'
import { IdentityContext } from '@/identity/context'
import Calendar from '@/pages/Calendar'
import CalendarSettings from '@/pages/CalendarSettings'
import EventForm from '@/pages/EventForm'
import { emptyEventForm, plusHour, toInput, validateEvent, withEnd, withStart } from '@/pages/EventForm/utils'
import EventView from '@/pages/EventView'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'
import { task } from '../helpers'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listEvents: vi.fn(),
  getEvent: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  listTasks: vi.fn(),
  getTrainings: vi.fn(),
}))

const mama: Member = { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true, birthDate: '1985-11-12' }
const kid: Member = { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false, birthDate: null }
const members = [mama, kid]

const event = (over: Partial<FamilyEvent> = {}): FamilyEvent => ({
  id: 'e1',
  title: 'Поход в театр',
  startDate: '2026-11-07',
  endDate: '2026-11-07',
  startTime: '18:00',
  endTime: '20:30',
  allFamily: true,
  memberIds: [],
  authorId: 'mama',
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
})

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderAt(path: string, me: Member = mama) {
  const identity = { familyCode: 'c', memberId: me.id, name: me.name, role: me.role, token: 'tok' }
  return render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...me, email: 'x@y.z' }, members }, failed: false }}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={[path]}>
              <Where />
              <Routes>
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/calendar/settings" element={<CalendarSettings />} />
                <Route path="/calendar/events/new" element={<EventForm />} />
                <Route path="/calendar/events/:id" element={<EventView />} />
                <Route path="/calendar/events/:id/edit" element={<EventForm />} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  setSession({ token: 'tok', memberId: 'mama' })
  vi.mocked(api.listEvents).mockReset().mockResolvedValue({ events: [] })
  vi.mocked(api.listTasks).mockReset().mockResolvedValue({ tasks: [], occurrences: [] })
  vi.mocked(api.getTrainings).mockReset().mockResolvedValue({ trainings: [] })
  vi.mocked(api.getEvent).mockReset().mockResolvedValue({ event: event() })
  vi.mocked(api.createEvent).mockReset().mockResolvedValue({ event: event() })
  vi.mocked(api.updateEvent).mockReset().mockResolvedValue({ event: event() })
  vi.mocked(api.deleteEvent).mockReset().mockResolvedValue(undefined)
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
})
afterEach(cleanup)

describe('календарь: виды', () => {
  it('месяц: сетка, сегодняшний выбранный день, праздник, день рождения, событие в списке выбранного дня', async () => {
    vi.mocked(api.listEvents).mockResolvedValue({ events: [event({ startDate: '2026-11-04', endDate: '2026-11-04', title: 'Субботник' })] })
    renderAt('/calendar?view=month&date=2026-11-04')
    expect(screen.getByRole('heading', { level: 1, name: 'Ноябрь 2026' })).toBeInTheDocument()
    // выбранный день: праздник и событие
    const section = await screen.findByRole('region', { name: 'Ср, 4 ноября' })
    expect(await within(section).findByText('Субботник')).toBeInTheDocument()
    expect(within(section).getByText('День народного единства')).toBeInTheDocument()
    // день рождения мамы в сетке: у ячейки 12 ноября есть запись
    expect(await screen.findByRole('gridcell', { name: 'Чт, 12 ноября, записей: 1' })).toBeInTheDocument()
    // нажатие на день выбирает его
    await userEvent.click(screen.getByRole('gridcell', { name: 'Чт, 12 ноября, записей: 1' }))
    expect(await screen.findByText('День рождения: Лена')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('date=2026-11-12')
  })

  it('неделя: семь дней, записи по дням; нажатие на день открывает его', async () => {
    vi.mocked(api.listEvents).mockResolvedValue({ events: [event()] })
    renderAt('/calendar?view=week&date=2026-11-07')
    expect(screen.getByRole('heading', { level: 1, name: '2–8 ноября' })).toBeInTheDocument()
    const sat = await screen.findByRole('region', { name: 'Сб, 7 ноября' })
    expect(await within(sat).findByText('Поход в театр')).toBeInTheDocument()
    expect(within(sat).getByText('18:00–20:30')).toBeInTheDocument()
    expect(screen.getAllByRole('region')).toHaveLength(7)
    await userEvent.click(screen.getByRole('button', { name: 'Вт, 3 ноября' }))
    expect(screen.getByTestId('where')).toHaveTextContent('view=day&date=2026-11-03')
  })

  it('день: записи списком, без записей подсказка; стрелки и «Сегодня»', async () => {
    renderAt('/calendar?view=day&date=2026-11-05')
    expect(screen.getByRole('heading', { level: 1, name: 'Четверг, 5 ноября' })).toBeInTheDocument()
    expect(await screen.findByText('В этот день записей нет')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Вперёд' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Пятница, 6 ноября' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Среда, 4 ноября' })).toBeInTheDocument()
    expect(await screen.findByText('День народного единства')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Сегодня' }))
    expect(screen.getByTestId('where')).not.toHaveTextContent('2026-11-04')
  })

  it('переключатель вида; без параметров открывается вид из настроек', async () => {
    localStorage.setItem('calendar-settings:mama', JSON.stringify({ view: 'week' }))
    renderAt('/calendar')
    expect(screen.getByRole('button', { name: 'Неделя' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Месяц' }))
    expect(screen.getByRole('button', { name: 'Месяц' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('grid', { name: 'Месяц' })).toBeInTheDocument()
  })

  it('задания и тренировки попадают в календарь', async () => {
    vi.mocked(api.listTasks).mockResolvedValue({
      tasks: [task({ id: 't1', title: 'Убрать комнату', assigneeId: 'kid', authorId: 'mama', time: '16:00' })],
      occurrences: [{ taskId: 't1', date: '2026-11-05', done: null, pending: null }],
    })
    vi.mocked(api.getTrainings).mockResolvedValue({ trainings: [{ weekday: 4, title: 'Плавание', place: 'Бассейн', startsAt: '17:00', endsAt: '18:00' }] })
    renderAt('/calendar?view=day&date=2026-11-05')
    expect(await screen.findByText('Убрать комнату')).toBeInTheDocument()
    expect(await screen.findByText('Плавание')).toBeInTheDocument()
    expect(screen.getByText('Миша · Бассейн')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Убрать комнату/ })).toHaveAttribute('href', '/tasks/t1?date=2026-11-05')
  })

  it('«+» слева сверху ведёт к новому событию на выбранный день', () => {
    renderAt('/calendar?view=month&date=2026-11-05')
    expect(screen.getByRole('link', { name: 'Новое событие' })).toHaveAttribute('href', '/calendar/events/new?date=2026-11-05')
    expect(screen.getByRole('link', { name: 'Настройки календаря' })).toHaveAttribute('href', '/calendar/settings')
  })
})

describe('календарь: настройки', () => {
  it('переключатели сохраняются в хранилище; скрытый вид и скрытый человек пропадают из календаря', async () => {
    vi.mocked(api.listEvents).mockResolvedValue({ events: [event({ startDate: '2026-11-04', endDate: '2026-11-04', title: 'Субботник' })] })
    const { unmount } = renderAt('/calendar/settings')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Праздники России' }))
    await userEvent.click(screen.getByRole('button', { name: 'Миша' }))
    await userEvent.click(screen.getByRole('button', { name: 'Неделя' }))
    expect(JSON.parse(localStorage.getItem('calendar-settings:mama')!)).toEqual({
      view: 'week',
      kinds: { event: true, task: true, birthday: true, training: true, holiday: false },
      hiddenMembers: ['kid'],
    })
    unmount()

    renderAt('/calendar?view=day&date=2026-11-04')
    expect(await screen.findByText('Субботник')).toBeInTheDocument()
    // праздник скрыт настройкой
    expect(screen.queryByText('День народного единства')).not.toBeInTheDocument()
  })

  it('выключенный вид не запрашивается', async () => {
    localStorage.setItem('calendar-settings:mama', JSON.stringify({ kinds: { event: false, task: false } }))
    renderAt('/calendar?view=month&date=2026-11-04')
    await screen.findByRole('grid', { name: 'Месяц' })
    expect(api.listEvents).not.toHaveBeenCalled()
    expect(api.listTasks).not.toHaveBeenCalled()
  })

  it('чужой участник скрыт: его день рождения не виден, мой остаётся', async () => {
    localStorage.setItem('calendar-settings:mama', JSON.stringify({ hiddenMembers: ['mama'] }))
    renderAt('/calendar?view=day&date=2026-11-12')
    await waitFor(() => expect(api.listEvents).toHaveBeenCalled())
    expect(screen.queryByText('День рождения: Лена')).not.toBeInTheDocument()
  })
})

describe('выбор времени', () => {
  it('открывается окном с колёсами; «Готово» применяет, быстрые варианты и колёса меняют черновик', async () => {
    const onChange = vi.fn()
    render(<TimePicker label="Начало" value="10:00" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Начало: 10:00' }))
    const dialog = screen.getByRole('dialog', { name: 'Начало' })
    await userEvent.click(within(within(dialog).getByRole('listbox', { name: 'Часы' })).getByRole('option', { name: '14' }))
    await userEvent.click(within(within(dialog).getByRole('listbox', { name: 'Минуты' })).getByRole('option', { name: '35' }))
    expect(within(dialog).getByText('14:35')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '18:00' }))
    expect(within(dialog).getByText('18:00', { selector: 'strong' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Готово' }))
    expect(onChange).toHaveBeenCalledWith('18:00')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape и затемнение закрывают без изменений; без правок onChange не вызывается', async () => {
    const onChange = vi.fn()
    render(<TimePicker label="Конец" value="11:00" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Конец: 11:00' }))
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Часы' })).getByRole('option', { name: '20' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Конец: 11:00' }))
    await userEvent.click(screen.getByRole('button', { name: 'Готово' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('минуты не из шага сохраняются в списке', async () => {
    render(<TimePicker label="Начало" value="09:07" onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Начало: 09:07' }))
    expect(within(screen.getByRole('listbox', { name: 'Минуты' })).getByRole('option', { name: '07', selected: true })).toBeInTheDocument()
  })
})

describe('форма события: правила', () => {
  it('конец подтягивается за началом', () => {
    const form = emptyEventForm('2026-11-07')
    expect(withStart(form, { startTime: '15:00' }).endTime).toBe('16:00')
    expect(withStart(form, { startTime: '23:30' }).endTime).toBe('23:59')
    // позже начала конец не трогаем
    expect(withStart({ ...form, endTime: '18:00' }, { startTime: '15:00' }).endTime).toBe('18:00')
    expect(withStart(form, { startDate: '2026-11-10' })).toMatchObject({ startDate: '2026-11-10', endDate: '2026-11-10' })
    expect(withEnd(form, { endDate: '2026-11-01' }).endDate).toBe('2026-11-07')
    expect(plusHour('08:15')).toBe('09:15')
  })

  it('проверка и отправляемые данные', () => {
    const ok = { ...emptyEventForm('2026-11-07'), title: ' Театр ' }
    expect(validateEvent(ok)).toBeNull()
    expect(validateEvent({ ...ok, title: '  ' })).toMatch(/название/)
    expect(validateEvent({ ...ok, endDate: '2026-11-06' })).toMatch(/раньше/)
    expect(validateEvent({ ...ok, startTime: '12:00', endTime: '11:00' })).toMatch(/позже начала/)
    // в многодневном событии конец может быть «раньше» по часам, на весь день время не важно
    expect(validateEvent({ ...ok, endDate: '2026-11-08', startTime: '20:00', endTime: '09:00' })).toBeNull()
    expect(validateEvent({ ...ok, allDay: true, startTime: '12:00', endTime: '11:00' })).toBeNull()
    expect(toInput(ok)).toEqual({ title: 'Театр', startDate: '2026-11-07', endDate: '2026-11-07', startTime: '10:00', endTime: '11:00', allFamily: true, memberIds: [] })
    expect(toInput({ ...ok, allDay: true, allFamily: false, memberIds: ['kid'] })).toMatchObject({ startTime: null, endTime: null, allFamily: false, memberIds: ['kid'] })
    // при «вся семья» выбранные участники не отправляются
    expect(toInput({ ...ok, allFamily: true, memberIds: ['kid'] }).memberIds).toEqual([])
  })
})

describe('создание и изменение события', () => {
  it('новое событие: дата из адреса, создание и возврат в календарь на этот день', async () => {
    const user = userEvent.setup()
    renderAt('/calendar/events/new?date=2026-11-07&view=week')
    await user.type(screen.getByLabelText('Название'), 'Поход в театр')
    // время начала через окно выбора
    await user.click(screen.getByRole('button', { name: 'Начало: 10:00' }))
    await user.click(within(screen.getByRole('listbox', { name: 'Часы' })).getByRole('option', { name: '18' }))
    await user.click(screen.getByRole('button', { name: 'Готово' }))
    expect(screen.getByRole('button', { name: 'Конец: 19:00' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Создать событие' }))
    await waitFor(() =>
      expect(api.createEvent).toHaveBeenCalledWith('tok', {
        title: 'Поход в театр',
        startDate: '2026-11-07',
        endDate: '2026-11-07',
        startTime: '18:00',
        endTime: '19:00',
        allFamily: true,
        memberIds: [],
      }),
    )
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/calendar?view=week&date=2026-11-07'))
  })

  it('весь день скрывает время; участники выбираются; автор всегда участвует', async () => {
    const user = userEvent.setup()
    renderAt('/calendar/events/new?date=2026-11-07')
    await user.type(screen.getByLabelText('Название'), 'Отпуск')
    await user.click(screen.getByRole('checkbox', { name: 'Весь день' }))
    expect(screen.queryByRole('button', { name: /^Начало: / })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Выбрать' }))
    expect(screen.getByText('Событие увидите только вы.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Вы участвуете всегда' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Миша' }))
    expect(screen.getByText(/увидят только выбранные участники/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Создать событие' }))
    await waitFor(() =>
      expect(api.createEvent).toHaveBeenCalledWith('tok', expect.objectContaining({ title: 'Отпуск', startTime: null, endTime: null, allFamily: false, memberIds: ['kid'] })),
    )
  })

  it('без названия и с неверным временем не отправляется, причина показана', async () => {
    const user = userEvent.setup()
    renderAt('/calendar/events/new?date=2026-11-07')
    await user.click(screen.getByRole('button', { name: 'Создать событие' }))
    expect(await screen.findByText('Введите название события.')).toBeInTheDocument()
    expect(api.createEvent).not.toHaveBeenCalled()
  })

  it('ошибка сервера: текст понятный, форма остаётся', async () => {
    vi.mocked(api.createEvent).mockRejectedValue(new api.ApiError(400, 'invalid_time'))
    const user = userEvent.setup()
    renderAt('/calendar/events/new?date=2026-11-07')
    await user.type(screen.getByLabelText('Название'), 'X')
    await user.click(screen.getByRole('button', { name: 'Создать событие' }))
    expect(await screen.findByText('Время окончания должно быть позже начала.')).toBeInTheDocument()
    expect(screen.getByLabelText('Название')).toHaveValue('X')
  })

  it('изменение своего события: форма заполнена, сохранение, удаление с подтверждением', async () => {
    vi.mocked(api.getEvent).mockResolvedValue({ event: event({ allFamily: false, memberIds: ['kid'] }) })
    const user = userEvent.setup()
    renderAt('/calendar/events/e1/edit')
    expect(await screen.findByDisplayValue('Поход в театр')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Начало: 18:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Миша' })).toHaveAttribute('aria-pressed', 'true')
    await user.clear(screen.getByLabelText('Название'))
    await user.type(screen.getByLabelText('Название'), 'Театр');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(api.updateEvent).toHaveBeenCalledWith('tok', 'e1', expect.objectContaining({ title: 'Театр', allFamily: false, memberIds: ['kid'] })))
  })

  it('удаление: подтверждение, потом запрос', async () => {
    const user = userEvent.setup()
    renderAt('/calendar/events/e1/edit')
    await screen.findByDisplayValue('Поход в театр')
    await user.click(screen.getByRole('button', { name: 'Удалить событие' }))
    expect(api.deleteEvent).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(api.deleteEvent).toHaveBeenCalledWith('tok', 'e1'))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/calendar'))
  })

  it('чужое событие нельзя изменить: перенаправляет на просмотр', async () => {
    vi.mocked(api.getEvent).mockResolvedValue({ event: event({ authorId: 'kid' }) })
    renderAt('/calendar/events/e1/edit')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/calendar\/events\/e1$/))
  })
})

describe('просмотр события', () => {
  it('детали и действия автора', async () => {
    renderAt('/calendar/events/e1')
    expect(await screen.findByRole('heading', { name: 'Поход в театр' })).toBeInTheDocument()
    expect(screen.getByText('7 ноября, 18:00–20:30')).toBeInTheDocument()
    expect(screen.getByText('Вся семья')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Изменить' })).toHaveAttribute('href', '/calendar/events/e1/edit')
    expect(screen.getByRole('button', { name: 'Удалить событие' })).toBeInTheDocument()
  })

  it('у участника, не автора, действий нет', async () => {
    vi.mocked(api.getEvent).mockResolvedValue({ event: event({ authorId: 'mama' }) })
    renderAt('/calendar/events/e1', kid)
    await screen.findByRole('heading', { name: 'Поход в театр' })
    expect(screen.queryByRole('link', { name: 'Изменить' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Удалить событие' })).not.toBeInTheDocument()
  })

  it('многодневное событие без времени, не найденное уводит в календарь', async () => {
    vi.mocked(api.getEvent).mockResolvedValue({ event: event({ startDate: '2026-11-10', endDate: '2026-11-14', startTime: null, endTime: null }) })
    renderAt('/calendar/events/e1')
    expect(await screen.findByText('10 ноября — 14 ноября')).toBeInTheDocument()
    cleanup()
    vi.mocked(api.getEvent).mockRejectedValue(new api.ApiError(404, 'event_not_found'))
    renderAt('/calendar/events/e1')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/calendar$/))
  })
})
