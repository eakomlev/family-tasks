import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { BackLink } from '@/components/BackLink'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

// страница-«список» с запасным адресом «назад» /list; открывается и по ссылке, и сама по себе
function Page({ name, next }: { name: string; next?: string }) {
  return (
    <>
      <h1>{name}</h1>
      {next && <Link to={next}>Дальше</Link>}
      <BackLink to="/list">Назад</BackLink>
    </>
  )
}

function app(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Where />
      <Routes>
        <Route path="/list" element={<Page name="Список" next="/calendar?view=week&date=2026-11-07" />} />
        <Route path="/calendar" element={<Page name="Календарь" next="/task" />} />
        <Route path="/task" element={<Page name="Задание" />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('ссылка «назад»', () => {
  it('возвращает на страницу, с которой открыли, вместе с адресом и параметрами, а не на свой запасной адрес', async () => {
    const user = userEvent.setup()
    app('/list')
    await user.click(screen.getByRole('link', { name: 'Дальше' }))
    expect(screen.getByRole('heading', { name: 'Календарь' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Дальше' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/task')
    // «Задание» открыли из календаря: назад в календарь (запасной адрес был /list)
    await user.click(screen.getByRole('link', { name: 'Назад' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/calendar?view=week&date=2026-11-07')
    // и дальше на шаг назад: туда, откуда открыт календарь
    await user.click(screen.getByRole('link', { name: 'Назад' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/list$/)
  })

  it('если пришли не из приложения (первая запись), идёт на запасной адрес', async () => {
    const user = userEvent.setup()
    app('/task')
    await user.click(screen.getByRole('link', { name: 'Назад' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/list$/)
  })

  it('ссылка по-прежнему ведёт на запасной адрес (для новой вкладки и поисковика)', () => {
    app('/task')
    expect(screen.getByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/list')
  })

  it('клик с зажатой клавишей не перехватывается: остаётся обычной ссылкой', async () => {
    const user = userEvent.setup()
    app('/list')
    await user.click(screen.getByRole('link', { name: 'Дальше' }))
    await user.keyboard('{Control>}')
    await user.click(screen.getByRole('link', { name: 'Назад' }))
    await user.keyboard('{/Control}')
    // историю назад не отматывали: остались на календаре (новая вкладка открылась бы браузером)
    expect(screen.getByTestId('where')).toHaveTextContent('/calendar')
  })
})
