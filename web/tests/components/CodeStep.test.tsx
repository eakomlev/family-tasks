import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { CodeStep } from '@/components/CodeStep'

function setup(over: Partial<Parameters<typeof CodeStep>[0]> = {}) {
  const props = {
    email: 'mama@example.com',
    busy: false,
    submitLabel: 'Войти',
    onSubmit: vi.fn(),
    onResend: vi.fn().mockResolvedValue(undefined),
    onChangeEmail: vi.fn(),
    ...over,
  }
  render(<CodeStep {...props} />)
  return props
}

// таймер перезапускается после каждого обновления состояния, поэтому секунды отсчитываем по одной
async function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
  }
}
const type = (value: string) => fireEvent.change(screen.getByLabelText('Код из письма'), { target: { value } })
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('CodeStep', () => {
  it('показывает email', () => {
    setup()
    expect(screen.getByText('mama@example.com')).toBeInTheDocument()
  })

  it('кнопка входа неактивна, пока нет 6 цифр, буквы не вводятся', async () => {
    const props = setup()
    const input = screen.getByLabelText('Код из письма')
    const submit = screen.getByRole('button', { name: 'Войти' })

    type('ab12')
    expect(input).toHaveValue('12')
    expect(submit).toBeDisabled()

    type('1234567')
    expect(input).toHaveValue('123456')
    expect(submit).toBeEnabled()

    click('Войти')
    expect(props.onSubmit).toHaveBeenCalledWith('123456')
  })

  it('пока идёт запрос, отправить нельзя', async () => {
    setup({ busy: true })
    type('123456')
    expect(screen.getByRole('button', { name: 'Подождите…' })).toBeDisabled()
  })

  it('повторная отправка блокируется на 60 секунд с обратным отсчётом', async () => {
    const props = setup()
    expect(screen.getByRole('button', { name: /ещё раз \(60 с\)/ })).toBeDisabled()

    await tick(10)
    expect(screen.getByRole('button', { name: /ещё раз \(50 с\)/ })).toBeDisabled()

    await tick(50)
    const resend = screen.getByRole('button', { name: 'Отправить код ещё раз' })
    expect(resend).toBeEnabled()

    await act(async () => click('Отправить код ещё раз'))
    expect(props.onResend).toHaveBeenCalledTimes(1)
    // после отправки отсчёт начинается заново
    expect(screen.getByRole('button', { name: /ещё раз \(60 с\)/ })).toBeDisabled()
  })

  it('ошибка повторной отправки показывается, отсчёт не запускается', async () => {
    const props = setup({ onResend: vi.fn().mockRejectedValue(new Error('x')) })
    await tick(60)
    await act(async () => click('Отправить код ещё раз'))
    expect(props.onResend).toHaveBeenCalled()
    expect(screen.getByText(/Не удалось отправить код/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить код ещё раз' })).toBeEnabled()
  })

  it('повторная отправка при исчерпанном лимите писем: понятное сообщение, кнопка остаётся доступной', async () => {
    const props = setup({ onResend: vi.fn().mockRejectedValue(new ApiError(503, 'mail_busy')) })
    await tick(60)
    await act(async () => click('Отправить код ещё раз'))
    expect(props.onResend).toHaveBeenCalled()
    expect(screen.getByText('Сервис отправки писем сейчас перегружен. Попробуйте позже.')).toBeInTheDocument()
    expect(screen.queryByText(/Не удалось отправить код/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить код ещё раз' })).toBeEnabled()
  })

  it('ошибка повторной отправки пропадает при следующей попытке', async () => {
    const onResend = vi.fn().mockRejectedValueOnce(new ApiError(503, 'mail_busy')).mockResolvedValue(undefined)
    setup({ onResend })
    await tick(60)
    await act(async () => click('Отправить код ещё раз'))
    expect(screen.getByText(/перегружен/)).toBeInTheDocument()
    await act(async () => click('Отправить код ещё раз'))
    expect(screen.queryByText(/перегружен/)).not.toBeInTheDocument()
  })

  it('показывает ошибку, переданную сверху, и «Изменить email»', async () => {
    const props = setup({ error: 'Неверный код' })
    expect(screen.getByText('Неверный код')).toBeInTheDocument()
    click('Изменить email')
    expect(props.onChangeEmail).toHaveBeenCalled()
  })
})
