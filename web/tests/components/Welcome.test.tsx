import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import { START_PATH } from '@/lib/routes'
import Welcome from '@/pages/Welcome'
import { SLIDES } from '@/pages/Welcome/components/Onboarding/data'

function renderAt(identity: Identity | null) {
  render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<p>Страница входа</p>} />
          <Route path={START_PATH} element={<p>Стартовая страница</p>} />
        </Routes>
      </MemoryRouter>
    </IdentityContext.Provider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('Welcome и стартовая страница', () => {
  it('стартовая страница это «Мой день»', () => {
    expect(START_PATH).toBe('/my-day')
  })

  it('вошедшего сразу отправляет на стартовую страницу', () => {
    renderAt({ familyCode: 'c', memberId: 'm', name: 'Лена', role: 'mama', token: 't' })
    expect(screen.getByText('Стартовая страница')).toBeInTheDocument()
  })

  it('слайдов пять, у каждого картинка', () => {
    expect(SLIDES).toHaveLength(5)
    expect(new Set(SLIDES.map((s) => s.image)).size).toBe(5)
  })

  it('в первый раз показывает слайдер, а не кнопки', () => {
    renderAt(null)
    expect(screen.getByText('Мой день')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Пропустить' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Создать семью' })).not.toBeInTheDocument()
  })

  it('«Пропустить» ведёт ко входу, а в следующий раз слайдер остаётся (не просмотрен до конца)', () => {
    renderAt(null)
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }))
    expect(screen.getByText('Страница входа')).toBeInTheDocument()
    expect(localStorage.getItem('onboardingSeen')).toBeNull()
  })

  it('после полного просмотра слайдер больше не показывается', () => {
    renderAt(null)
    for (let i = 0; i < SLIDES.length - 1; i++) fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
    expect(screen.queryByRole('button', { name: 'Пропустить' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Начать' }))
    expect(screen.getByRole('link', { name: 'Создать семью' })).toBeInTheDocument()
    expect(localStorage.getItem('onboardingSeen')).toBe('1')
  })

  it('уже видевшему сразу показывает кнопки', () => {
    localStorage.setItem('onboardingSeen', '1')
    renderAt(null)
    expect(screen.getByRole('link', { name: 'Создать семью' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Уже есть семья? Войти' })).toBeInTheDocument()
  })

  it('чип на хабе открывает слайдер с нужного слайда, «Пропустить» возвращает к хабу', () => {
    localStorage.setItem('onboardingSeen', '1')
    renderAt(null)
    fireEvent.click(screen.getByRole('button', { name: '💬 Чат' }))
    expect(screen.getByRole('button', { name: 'Слайд 4' })).toHaveAttribute('aria-current', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }))
    expect(screen.getByRole('link', { name: 'Создать семью' })).toBeInTheDocument()
  })
})
