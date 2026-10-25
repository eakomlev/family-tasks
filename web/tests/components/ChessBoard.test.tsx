import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChessBoard } from '@/components/ChessBoard'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const square = (name: string) => screen.getByRole('gridcell', { name: new RegExp(`^${name}\\b`) })

afterEach(cleanup)

describe('шахматная доска', () => {
  it('нажатие на свою фигуру показывает, куда она может пойти; нажатие на такую клетку делает ход', async () => {
    const onMove = vi.fn()
    render(<ChessBoard fen={START} orientation="w" lastMove={null} canMove onMove={onMove} />)
    await userEvent.click(square('e2'))
    expect(square('e3')).toHaveAccessibleName(/можно сходить/)
    expect(square('e4')).toHaveAccessibleName(/можно сходить/)
    expect(square('e5')).not.toHaveAccessibleName(/можно сходить/)
    await userEvent.click(square('e4'))
    expect(onMove).toHaveBeenCalledWith('e2', 'e4')
  })

  it('чужая фигура и пустая клетка не выбираются; повторное нажатие снимает выбор', async () => {
    const onMove = vi.fn()
    render(<ChessBoard fen={START} orientation="w" lastMove={null} canMove onMove={onMove} />)
    await userEvent.click(square('e7'))
    expect(square('e6')).not.toHaveAccessibleName(/можно сходить/)
    await userEvent.click(square('g1'))
    expect(square('f3')).toHaveAccessibleName(/можно сходить/)
    await userEvent.click(square('g1'))
    expect(square('f3')).not.toHaveAccessibleName(/можно сходить/)
    expect(onMove).not.toHaveBeenCalled()
  })

  it('нельзя ходить, пока не ваш ход: клетки недоступны', () => {
    render(<ChessBoard fen={START} orientation="w" lastMove={null} canMove={false} onMove={() => {}} />)
    expect(square('e2')).toBeDisabled()
  })

  it('чёрным доска перевёрнута, а ходить они могут только в свою очередь', async () => {
    const onMove = vi.fn()
    // ход чёрных
    render(<ChessBoard fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" orientation="b" lastMove={{ from: 'e2', to: 'e4' }} canMove onMove={onMove} />)
    const cells = screen.getAllByRole('gridcell')
    // первая клетка сверху у чёрных h1, последняя a8
    expect(cells[0]).toHaveAccessibleName(/^h1\b/)
    expect(cells[63]).toHaveAccessibleName(/^a8\b/)
    await userEvent.click(square('e7'))
    await userEvent.click(square('e5'))
    expect(onMove).toHaveBeenCalledWith('e7', 'e5')
  })

  it('своя фигура не выбирается, если сейчас ход соперника по позиции', async () => {
    render(<ChessBoard fen={START} orientation="b" lastMove={null} canMove onMove={() => {}} />)
    await userEvent.click(square('e7'))
    expect(square('e6')).not.toHaveAccessibleName(/можно сходить/)
  })
})

describe('превращение пешки', () => {
  // белая пешка на a7 может превратиться на a8, чёрные короли убраны от удара
  const PROMOTION = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'

  it('на последней горизонтали спрашивает фигуру и передаёт выбор', async () => {
    const onMove = vi.fn()
    render(<ChessBoard fen={PROMOTION} orientation="w" lastMove={null} canMove onMove={onMove} />)
    await userEvent.click(square('a7'))
    await userEvent.click(square('a8'))
    // пока человек выбирает, ход не уходит
    expect(onMove).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'Во что превратить пешку?' })
    expect(within(dialog).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['ферзь', 'ладья', 'слон', 'конь'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'конь' }))
    expect(onMove).toHaveBeenCalledWith('a7', 'a8', 'n')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('нажатие за пределами окна отменяет выбор, ход не делается, пешку можно выбрать снова', async () => {
    const onMove = vi.fn()
    render(<ChessBoard fen={PROMOTION} orientation="w" lastMove={null} canMove onMove={onMove} />)
    await userEvent.click(square('a7'))
    await userEvent.click(square('a8'))
    await userEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onMove).not.toHaveBeenCalled()
    await userEvent.click(square('a7'))
    expect(square('a8')).toHaveAccessibleName(/можно сходить/)
  })

  it('обычный ход пешки выбора не просит', async () => {
    const onMove = vi.fn()
    render(<ChessBoard fen={START} orientation="w" lastMove={null} canMove onMove={onMove} />)
    await userEvent.click(square('e2'))
    await userEvent.click(square('e4'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onMove).toHaveBeenCalledWith('e2', 'e4')
  })
})
