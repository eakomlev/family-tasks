import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { PillTabs } from '@/components/PillTabs'

afterEach(cleanup)

describe('PillTabs', () => {
  it('ссылки на страницы, текущая отмечена, у вкладки может быть число', () => {
    render(
      <MemoryRouter>
        <PillTabs label="Событие и чат" tabs={[{ to: '/e/1', label: 'Событие', active: true }, { to: '/chat/event-1', label: 'Чат', active: false, badge: 3 }]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Событие' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Чат/ })).toHaveAttribute('href', '/chat/event-1')
    expect(screen.getByLabelText('Непрочитанных: 3')).toBeInTheDocument()
  })
})
