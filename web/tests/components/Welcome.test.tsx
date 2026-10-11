import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { IdentityContext } from '@/identity/context'
import type { Identity } from '@/identity/types'
import { START_PATH } from '@/lib/routes'
import Welcome from '@/pages/Welcome'

function renderAt(identity: Identity | null) {
  render(
    <IdentityContext.Provider value={{ identity, save: async () => {}, clear: async () => {} }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path={START_PATH} element={<p>Стартовая страница</p>} />
        </Routes>
      </MemoryRouter>
    </IdentityContext.Provider>,
  )
}

describe('Welcome и стартовая страница', () => {
  it('стартовая страница это «Мой день»', () => {
    expect(START_PATH).toBe('/my-day')
  })

  it('вошедшего сразу отправляет на стартовую страницу', () => {
    renderAt({ familyCode: 'c', memberId: 'm', name: 'Лена', role: 'mama', token: 't' })
    expect(screen.getByText('Стартовая страница')).toBeInTheDocument()
  })

  it('без входа показывает приветствие с кнопками', () => {
    renderAt(null)
    expect(screen.getByRole('link', { name: 'Создать семью' })).toBeInTheDocument()
    expect(screen.queryByText('Стартовая страница')).not.toBeInTheDocument()
  })
})
