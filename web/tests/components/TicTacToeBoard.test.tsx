import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TicTacToeBoard } from '@/components/TicTacToeBoard'
import { winningLine } from '@/lib/ticTacToe'

afterEach(cleanup)

describe('поле крестиков-ноликов', () => {
  it('находит выигравшую линию', () => {
    expect(winningLine('XXXOO----')).toEqual([0, 1, 2])
    expect(winningLine('X-OXO-X--')).toEqual([0, 3, 6])
    expect(winningLine('XOXXOOOXX')).toBeNull()
    expect(winningLine('---------')).toBeNull()
  })

  it('нажатие на пустую клетку делает ход, занятые и чужой ход недоступны', () => {
    const onPlace = vi.fn()
    const { rerender } = render(<TicTacToeBoard board="X--------" lastCell={0} canMove onPlace={onPlace} />)
    expect(screen.getByRole('gridcell', { name: 'Клетка 1: крестик' })).toBeDisabled()
    fireEvent.click(screen.getByRole('gridcell', { name: 'Клетка 5: пусто' }))
    expect(onPlace).toHaveBeenCalledWith(4)
    rerender(<TicTacToeBoard board="X--------" lastCell={0} canMove={false} onPlace={onPlace} />)
    expect(screen.getByRole('gridcell', { name: 'Клетка 5: пусто' })).toBeDisabled()
  })
})
