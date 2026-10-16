import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BackLink } from '@/components/BackLink'
import { useSlideIn } from '@/lib/useSlideIn'
import { Link } from 'react-router-dom'

function Probe({ name }: { name: string }) {
  return (
    <>
      <p>{`${name}: ${useSlideIn() ? 'выезжает' : 'без анимации'}`}</p>
      <Link to="/b">Вперёд</Link>
      <BackLink to="/a">Назад</BackLink>
    </>
  )
}

function renderApp() {
  render(
    <MemoryRouter initialEntries={['/a']}>
      <Routes>
        <Route path="/a" element={<Probe name="A" />} />
        <Route path="/b" element={<Probe name="B" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('анимация выезда страницы', () => {
  it('вперёд выезжает, по ссылке «назад» нет', async () => {
    renderApp()
    // первая страница открыта без перехода (POP): анимации нет
    expect(screen.getByText('A: без анимации')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Вперёд' }))
    expect(screen.getByText('B: выезжает')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Назад' }))
    expect(screen.getByText('A: без анимации')).toBeInTheDocument()
  })
})
