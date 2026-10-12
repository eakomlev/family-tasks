import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LessonViewList } from '@/components/LessonViewList'

const lessons = [
  { key: 'a', subject: 'Химия', startsAt: '09:00', endsAt: '09:45', room: '12а' },
  { key: 'b', subject: 'Физика', startsAt: null, endsAt: null, room: null },
]

describe('LessonViewList: кабинет', () => {
  it('номер кабинета виден у урока, где он указан, у остальных подписи нет', () => {
    render(<MemoryRouter><LessonViewList lessons={lessons} /></MemoryRouter>)
    expect(screen.getAllByText(/каб\./)).toHaveLength(1)
    expect(screen.getByText('каб. 12а')).toBeInTheDocument()
  })

  it('в режиме ссылок тоже, и ссылка по-прежнему ведёт по предмету', () => {
    render(<MemoryRouter><LessonViewList lessons={lessons} getLink={(l) => `/lesson-report?subject=${encodeURIComponent(l.subject)}`} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Химия/ })).toHaveAttribute('href', '/lesson-report?subject=%D0%A5%D0%B8%D0%BC%D0%B8%D1%8F')
    expect(screen.getByText('каб. 12а')).toBeInTheDocument()
  })
})
