import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MoodDialog } from '@/components/MoodDialog'
import { MoodMark } from '@/components/MoodMark'
import { currentMood } from '@/lib/mood'

// часовой пояс прогона Москва: 12 октября 2026, полдень
const now = new Date('2026-10-12T09:00:00Z')

describe('currentMood', () => {
  it('сегодняшнее настроение видно', () => {
    expect(currentMood({ value: 5, at: '2026-10-12T05:30:00Z' }, now)?.emoji).toBe('😄')
    expect(currentMood({ value: 1, at: '2026-10-12T05:30:00Z' }, now)?.label).toBe('Грусть')
  })

  it('вчерашнее и пустое считаются сброшенными', () => {
    expect(currentMood({ value: 5, at: '2026-10-11T08:00:00Z' }, now)).toBeUndefined()
    expect(currentMood(null, now)).toBeUndefined()
    expect(currentMood(undefined, now)).toBeUndefined()
  })

  it('граница дня по местному времени: 21:30 UTC уже следующий день в Москве', () => {
    expect(currentMood({ value: 3, at: '2026-10-11T21:30:00Z' }, now)?.value).toBe(3)
  })
})

describe('MoodMark', () => {
  it('рядом с именем показывает смайлик с подписью; без настроения ничего', () => {
    const { rerender, container } = render(<MoodMark mood={{ value: 4, at: '2026-10-12T05:30:00Z' }} now={now} />)
    expect(screen.getByRole('img', { name: 'Настроение: Хорошо' })).toHaveTextContent('🙂')
    rerender(<MoodMark mood={null} now={now} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('MoodDialog', () => {
  it('пять эмоций от радости до грусти, выбор отправляется', async () => {
    const onPick = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MoodDialog forced onPick={onPick} onClose={() => {}} />)
    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(labels).toHaveLength(5)
    expect(labels[0]).toContain('Радость')
    expect(labels[4]).toContain('Грусть')
    await user.click(screen.getByRole('button', { name: /Нормально/ }))
    expect(onPick).toHaveBeenCalledWith(3)
  })

  it('принудительное окно закрыть нельзя, обычное можно (и текущий выбор отмечен)', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<MoodDialog forced onPick={async () => {}} onClose={onClose} />)
    expect(screen.queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()

    rerender(<MoodDialog current={4} onPick={async () => {}} onClose={onClose} />)
    expect(screen.getByRole('button', { name: /Хорошо/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('ошибка сохранения: сообщение, окно остаётся, можно повторить', async () => {
    const onPick = vi.fn().mockRejectedValueOnce(new Error('нет')).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MoodDialog forced onPick={onPick} onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Радость/ }))
    expect(await screen.findByText(/Не удалось сохранить/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Радость/ })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Радость/ }))
    expect(onPick).toHaveBeenCalledTimes(2)
  })
})
