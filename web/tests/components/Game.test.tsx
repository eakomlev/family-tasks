import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api'
import type { Game as GameDto, Member } from '@/api'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityContext } from '@/identity/context'
import { RealtimeContext } from '@/realtime/context'
import type { Listener } from '@/realtime/types'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import GameScreen from '@/pages/Game'
import GamesList from '@/pages/GamesList'
import { ProfileContext } from '@/profile/context'
import { makeStore } from '@/store'
import { setSession } from '@/store/session'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  listGames: vi.fn(),
  getGame: vi.fn(),
  inviteToGame: vi.fn(),
  acceptGame: vi.fn(),
  declineGame: vi.fn(),
  cancelGame: vi.fn(),
  moveInGame: vi.fn(),
  resignGame: vi.fn(),
}))

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const members: Member[] = [
  { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
  { id: 'igor', name: 'Игорь', role: 'papa', avatar: null, isOwner: false },
]

const game = (patch: Partial<GameDto> = {}): GameDto => ({
  id: 'g1',
  kind: 'chess',
  status: 'active',
  inviterId: 'me',
  inviteeId: 'igor',
  whiteId: 'me',
  turnId: 'me',
  fen: START,
  moves: [],
  lastMove: null,
  result: null,
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T10:00:00Z',
  ...patch,
})

// игра на «сервере»: запрос игры отдаёт текущее состояние, действия его меняют
let current: GameDto
const serve = (initial: GameDto) => {
  current = initial
  vi.mocked(api.getGame).mockImplementation(async () => ({ game: current }))
}
const answer = (next: GameDto) => async () => {
  current = next
  return { game: next }
}

function renderAt(path: string) {
  setSession({ token: 'tok', memberId: 'me' })
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false }}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route path="/games/:id" element={<GameScreen />} />
                <Route path="/family/:memberId/games" element={<GamesList />} />
                <Route path="/family" element={<p>Семья</p>} />
                <Route path="/" element={<p>Мой день</p>} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
}

// Игра с живым сокетом: событие games от сервера должно обновить открытую доску без перезагрузки страницы
function renderLive(path: string) {
  setSession({ token: 'tok', memberId: 'me' })
  const identity = { familyCode: 'c', memberId: 'me', name: 'Лена', role: 'mama' as const, token: 'tok' }
  const listeners = new Set<Listener>()
  const realtime = { subscribe: (l: Listener) => (listeners.add(l), () => void listeners.delete(l)), setViewing: vi.fn() }
  render(
    <Provider store={makeStore({ hydrate: false })}>
      <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
        <ProfileContext.Provider value={{ data: { me: { ...members[0], email: 'l@x.y' }, members }, failed: false }}>
          <RealtimeContext.Provider value={realtime}>
            <ConfirmProvider>
              <RealtimeBridge />
              <MemoryRouter initialEntries={[path]}>
                <Routes>
                  <Route path="/games/:id" element={<GameScreen />} />
                </Routes>
              </MemoryRouter>
            </ConfirmProvider>
          </RealtimeContext.Provider>
        </ProfileContext.Provider>
      </IdentityContext.Provider>
    </Provider>,
  )
  return { realtime, emit: (event: Parameters<Listener>[0]) => listeners.forEach((l) => l(event)) }
}

beforeEach(() => {
  vi.mocked(api.listGames).mockReset().mockResolvedValue({ games: [] })
  vi.mocked(api.getGame).mockReset()
  vi.mocked(api.inviteToGame).mockReset()
  vi.mocked(api.acceptGame).mockReset()
  vi.mocked(api.declineGame).mockReset()
  vi.mocked(api.cancelGame).mockReset()
  vi.mocked(api.moveInGame).mockReset()
  vi.mocked(api.resignGame).mockReset()
})
afterEach(cleanup)

describe('приглашение в игру', () => {
  it('список игр: шахматы доступны, остальные «Скоро»', async () => {
    renderAt('/family/igor/games')
    expect(await screen.findByRole('button', { name: 'Шахматы: пригласить' })).toBeEnabled()
    for (const name of ['Шашки', 'Крестики-нолики', 'Морской бой']) expect(screen.getByRole('button', { name: `${name}: скоро` })).toBeDisabled()
  })

  it('выбор шахмат: подтверждение, приглашение уходит, открывается игра', async () => {
    vi.mocked(api.inviteToGame).mockResolvedValue({ game: game({ status: 'invited', whiteId: null, turnId: null }) })
    vi.mocked(api.getGame).mockResolvedValue({ game: game({ status: 'invited', whiteId: null, turnId: null }) })
    renderAt('/family/igor/games')
    await userEvent.click(await screen.findByRole('button', { name: 'Шахматы: пригласить' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Пригласить' }))
    await waitFor(() => expect(api.inviteToGame).toHaveBeenCalledWith('tok', 'chess', 'igor'))
    expect(await screen.findByText(/Ждём ответа: Игорь/)).toBeInTheDocument()
  })

  it('отказ в подтверждении: приглашение не уходит', async () => {
    renderAt('/family/igor/games')
    await userEvent.click(await screen.findByRole('button', { name: 'Шахматы: пригласить' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Отмена' }))
    expect(api.inviteToGame).not.toHaveBeenCalled()
  })

  it('уже идёт игра с этим человеком: открывается она, а не новое приглашение', async () => {
    vi.mocked(api.listGames).mockResolvedValue({ games: [game()] })
    vi.mocked(api.getGame).mockResolvedValue({ game: game() })
    renderAt('/family/igor/games')
    await userEvent.click(await screen.findByRole('button', { name: 'Шахматы: пригласить' }))
    expect(await screen.findByText('Ваш ход')).toBeInTheDocument()
    expect(api.inviteToGame).not.toHaveBeenCalled()
  })

  it('сервер ответил «уже есть»: открывается существующая игра', async () => {
    vi.mocked(api.inviteToGame).mockRejectedValue(new api.ApiError(409, 'game_exists', { game: { id: 'g1' } }))
    vi.mocked(api.getGame).mockResolvedValue({ game: game({ status: 'invited', whiteId: null, turnId: null }) })
    renderAt('/family/igor/games')
    await userEvent.click(await screen.findByRole('button', { name: 'Шахматы: пригласить' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Пригласить' }))
    expect(await screen.findByText(/Ждём ответа: Игорь/)).toBeInTheDocument()
  })
})

describe('игра по сокету', () => {
  it('ход соперника появляется на открытой доске по сигналу games, без обновления страницы', async () => {
    serve(game({ turnId: 'igor' }))
    const { emit, realtime } = renderLive('/games/g1')
    expect(await screen.findByText('Ход: Игорь')).toBeInTheDocument()
    // экран сообщает серверу, что игра открыта: пуш о ходе не нужен
    expect(realtime.setViewing).toHaveBeenCalledWith('game-g1')

    // соперник сходил: сервер обновил игру и прислал сигнал
    current = game({
      turnId: 'me',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      moves: [
        { from: 'e2', to: 'e4', san: 'e4' },
        { from: 'e7', to: 'e5', san: 'e5' },
      ],
      lastMove: { from: 'e7', to: 'e5', san: 'e5' },
    })
    emit({ type: 'games' })
    expect(await screen.findByText('Ваш ход')).toBeInTheDocument()
    expect(screen.getByText(/Последний ход чёрных: e5/)).toBeInTheDocument()
  })

  it('приглашение принято соперником: ожидание сменяется доской', async () => {
    serve(game({ status: 'invited', whiteId: null, turnId: null }))
    const { emit } = renderLive('/games/g1')
    expect(await screen.findByText(/Ждём ответа: Игорь/)).toBeInTheDocument()
    current = game()
    emit({ type: 'games' })
    expect(await screen.findByRole('grid', { name: 'Шахматная доска' })).toBeInTheDocument()
  })
})

describe('экран игры', () => {
  it('приглашённый: «Принять» и «Отклонить»', async () => {
    serve(game({ status: 'invited', inviterId: 'igor', inviteeId: 'me', whiteId: null, turnId: null }))
    vi.mocked(api.acceptGame).mockImplementation(answer(game({ inviterId: 'igor', inviteeId: 'me' })))
    renderAt('/games/g1')
    await userEvent.click(await screen.findByRole('button', { name: 'Принять' }))
    await waitFor(() => expect(api.acceptGame).toHaveBeenCalledWith('tok', 'g1'))
    expect(await screen.findByRole('grid', { name: 'Шахматная доска' })).toBeInTheDocument()
    expect(screen.getByText('Ваш ход')).toBeInTheDocument()
  })

  it('пригласивший может отозвать приглашение', async () => {
    serve(game({ status: 'invited', whiteId: null, turnId: null }))
    vi.mocked(api.cancelGame).mockImplementation(answer(game({ status: 'cancelled', whiteId: null, turnId: null })))
    renderAt('/games/g1')
    await userEvent.click(await screen.findByRole('button', { name: 'Отозвать приглашение' }))
    expect(await screen.findByText('Приглашение отозвано.')).toBeInTheDocument()
  })

  it('мой ход: фигуры двигаются, ход уходит на сервер, показан последний ход', async () => {
    serve(game())
    vi.mocked(api.moveInGame).mockImplementation(
      answer(
        game({
          turnId: 'igor',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          moves: [{ from: 'e2', to: 'e4', san: 'e4' }],
          lastMove: { from: 'e2', to: 'e4', san: 'e4' },
        }),
      ),
    )
    renderAt('/games/g1')
    await userEvent.click(await screen.findByRole('gridcell', { name: /^e2\b/ }))
    await userEvent.click(screen.getByRole('gridcell', { name: /^e4\b/ }))
    await waitFor(() => expect(api.moveInGame).toHaveBeenCalledWith('tok', 'g1', { from: 'e2', to: 'e4' }))
    expect(await screen.findByText('Ход: Игорь')).toBeInTheDocument()
    expect(screen.getByText(/Последний ход белых: e4/)).toBeInTheDocument()
  })

  it('«Сдаться» просит подтверждение', async () => {
    serve(game())
    vi.mocked(api.resignGame).mockImplementation(answer(game({ status: 'finished', turnId: null, result: { winnerId: 'igor', reason: 'resign' } })))
    renderAt('/games/g1')
    await userEvent.click(await screen.findByRole('button', { name: 'Сдаться' }))
    // в окне подтверждения кнопка с тем же названием стоит последней
    const confirmButtons = await screen.findAllByRole('button', { name: 'Сдаться' })
    await userEvent.click(confirmButtons[confirmButtons.length - 1])
    await waitFor(() => expect(api.resignGame).toHaveBeenCalledWith('tok', 'g1'))
    expect(await screen.findByText('Вы сдались')).toBeInTheDocument()
  })

  it('завершённая игра: итог, ходить нельзя', async () => {
    vi.mocked(api.getGame).mockResolvedValue({ game: game({ status: 'finished', turnId: null, result: { winnerId: 'me', reason: 'checkmate' } }) })
    renderAt('/games/g1')
    expect(await screen.findByText('Мат. Вы победили!')).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: /^e2\b/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Сдаться' })).not.toBeInTheDocument()
  })

  it('ошибка хода показывается под доской', async () => {
    vi.mocked(api.getGame).mockResolvedValue({ game: game() })
    vi.mocked(api.moveInGame).mockRejectedValue(new api.ApiError(409, 'not_your_turn'))
    renderAt('/games/g1')
    await userEvent.click(await screen.findByRole('gridcell', { name: /^e2\b/ }))
    await userEvent.click(screen.getByRole('gridcell', { name: /^e4\b/ }))
    expect(await screen.findByText('Сейчас ход соперника.')).toBeInTheDocument()
  })
})
