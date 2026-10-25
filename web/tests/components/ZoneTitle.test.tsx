import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ZoneTitle } from '@/components/ZoneTitle'

afterEach(cleanup)

describe('шапка зоны «Моего дня»', () => {
  it('название это заголовок, счётчик подписан для скринридеров, ссылки справа на месте', () => {
    render(
      <ZoneTitle tone="decide" icon="hourglass" count={3} countLabel="Заданий: 3" right={<a href="/x">Расписание</a>}>
        Ждут подтверждения
      </ZoneTitle>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Ждут подтверждения' })).toBeInTheDocument()
    expect(screen.getByLabelText('Заданий: 3')).toHaveTextContent('3')
    expect(screen.getByRole('link', { name: 'Расписание' })).toBeInTheDocument()
  })

  it('без счётчика его нет, значок скрыт от скринридеров и нарисован', () => {
    const { container } = render(
      <ZoneTitle tone="kids" icon="kids">
        Дети
      </ZoneTitle>,
    )
    expect(screen.queryByLabelText(/Заданий|Игр|Детей/)).toBeNull()
    const chip = container.querySelector('[aria-hidden="true"] svg path')
    expect(chip?.getAttribute('d')?.length).toBeGreaterThan(10)
  })

  it('все цвета зон заданы в обеих палитрах', async () => {
    const css = (await import('@/components/GlobalStyle/index.tsx?raw')).default
    for (const tone of ['decide', 'mine', 'kids', 'games']) {
      for (const part of ['bg', 'fg', 'line']) {
        // по одному определению в светлой и в тёмной палитре
        expect(css.split(`--zone-${tone}-${part}:`).length - 1, `--zone-${tone}-${part}`).toBe(2)
      }
    }
  })
})
