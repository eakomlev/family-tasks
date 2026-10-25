import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckersBoard } from '@/components/CheckersBoard'

afterEach(cleanup)

// Поле из расстановки вида { c3: 'w' }: 64 знака, ряды снизу вверх
const FILES = 'abcdefgh'
function boardOf(pieces: Record<string, string>): string {
  const cells = Array(64).fill('.')
  for (const [name, piece] of Object.entries(pieces)) cells[(Number(name[1]) - 1) * 8 + FILES.indexOf(name[0])] = piece
  return cells.join('')
}
const square = (name: string) => screen.getByRole('gridcell', { name: new RegExp(`^${name}\\b`) })

describe('доска шашек', () => {
  it('нажатие на шашку с ходом показывает, куда она может пойти; нажатие на такую клетку делает ход', async () => {
    const onPlay = vi.fn()
    render(<CheckersBoard board={boardOf({ c3: 'w' })} legal={[['c3', 'b4'], ['c3', 'd4']]} lastPath={null} orientation="w" canMove onPlay={onPlay} />)
    await userEvent.click(square('c3'))
    expect(square('b4')).toHaveAccessibleName(/можно сходить/)
    expect(square('d4')).toHaveAccessibleName(/можно сходить/)
    expect(square('c5')).not.toHaveAccessibleName(/можно сходить/)
    await userEvent.click(square('d4'))
    expect(onPlay).toHaveBeenCalledWith(['c3', 'd4'])
  })

  it('удар в несколько прыжков набирается по клеткам и уходит целиком', async () => {
    const onPlay = vi.fn()
    render(<CheckersBoard board={boardOf({ c3: 'w', d4: 'b', f6: 'b' })} legal={[['c3', 'e5', 'g7']]} lastPath={null} orientation="w" canMove onPlay={onPlay} />)
    await userEvent.click(square('c3'))
    await userEvent.click(square('e5'))
    // пока путь не закончен, ход не уходит
    expect(onPlay).not.toHaveBeenCalled()
    expect(square('g7')).toHaveAccessibleName(/можно сходить/)
    await userEvent.click(square('g7'))
    expect(onPlay).toHaveBeenCalledWith(['c3', 'e5', 'g7'])
  })

  it('шашка без допустимого хода не выбирается (при обязательном ударе остальные заблокированы)', async () => {
    const onPlay = vi.fn()
    render(<CheckersBoard board={boardOf({ c3: 'w', d4: 'b', a1: 'w' })} legal={[['c3', 'e5']]} lastPath={null} orientation="w" canMove onPlay={onPlay} />)
    await userEvent.click(square('a1'))
    expect(square('b2')).not.toHaveAccessibleName(/можно сходить/)
    await userEvent.click(square('c3'))
    expect(square('e5')).toHaveAccessibleName(/можно сходить/)
  })

  it('повторное нажатие на выбранную шашку снимает выбор, другая своя переносит', async () => {
    const onPlay = vi.fn()
    render(<CheckersBoard board={boardOf({ c3: 'w', e3: 'w' })} legal={[['c3', 'd4'], ['e3', 'f4']]} lastPath={null} orientation="w" canMove onPlay={onPlay} />)
    await userEvent.click(square('c3'))
    expect(square('d4')).toHaveAccessibleName(/можно сходить/)
    await userEvent.click(square('e3'))
    expect(square('d4')).not.toHaveAccessibleName(/можно сходить/)
    expect(square('f4')).toHaveAccessibleName(/можно сходить/)
    await userEvent.click(square('e3'))
    expect(square('f4')).not.toHaveAccessibleName(/можно сходить/)
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('нельзя ходить, пока не ваш ход: клетки недоступны', () => {
    render(<CheckersBoard board={boardOf({ c3: 'w' })} legal={[['c3', 'd4']]} lastPath={null} orientation="w" canMove={false} onPlay={() => {}} />)
    expect(square('c3')).toBeDisabled()
  })

  it('чёрным доска перевёрнута, дамка подписана', () => {
    render(<CheckersBoard board={boardOf({ a1: 'W', h8: 'B' })} legal={[]} lastPath={null} orientation="b" canMove onPlay={() => {}} />)
    const cells = screen.getAllByRole('gridcell')
    // сверху у чёрных ряд 1 справа налево: первая клетка h1, последняя a8
    expect(cells[0]).toHaveAccessibleName(/^h1\b/)
    expect(cells[63]).toHaveAccessibleName(/^a8\b/)
    expect(square('a1')).toHaveAccessibleName(/белая дамка/)
    expect(square('h8')).toHaveAccessibleName(/чёрная дамка/)
  })

  it('новая позиция с сервера сбрасывает набранный путь', async () => {
    const legal = [['c3', 'e5', 'g7']]
    const { rerender } = render(<CheckersBoard board={boardOf({ c3: 'w', d4: 'b', f6: 'b' })} legal={legal} lastPath={null} orientation="w" canMove onPlay={() => {}} />)
    await userEvent.click(square('c3'))
    await userEvent.click(square('e5'))
    expect(square('g7')).toHaveAccessibleName(/можно сходить/)
    rerender(<CheckersBoard board={boardOf({ a1: 'w' })} legal={[]} lastPath={['c3', 'g7']} orientation="w" canMove onPlay={() => {}} />)
    expect(square('g7')).not.toHaveAccessibleName(/можно сходить/)
  })
})
