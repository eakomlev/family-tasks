import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/api'
import { MessageBubble } from '@/pages/ChatRoom/components/MessageBubble'

afterEach(cleanup)

const message = {
  id: 'm1',
  senderId: 'igor',
  text: 'Привет всем',
  caption: 'Привет всем',
  createdAt: '2026-10-26T10:00:00Z',
  editedAt: null,
  replyTo: null,
  media: [],
  files: [],
  videos: [],
  reactions: [],
  awards: [],
} as unknown as ChatMessage

describe('аватар слева от чужого сообщения в групповом чате', () => {
  it('у последнего сообщения подряд от автора виден его аватар (инициал), текст сообщения на месте', () => {
    render(<MessageBubble message={message} mine={false} senderName="Игорь" showSender senderAvatar={{ name: 'Игорь', seed: 'igor', src: null }} />)
    expect(screen.getByText('И')).toBeInTheDocument()
    expect(screen.getByText('Привет всем')).toBeInTheDocument()
  })

  it('у фото профиля показывается фото', () => {
    const { container } = render(<MessageBubble message={message} mine={false} senderName="Игорь" showSender senderAvatar={{ name: 'Игорь', seed: 'igor', src: 'data:image/jpeg;base64,AAAA' }} />)
    expect(container.querySelector('img[src="data:image/jpeg;base64,AAAA"]')).not.toBeNull()
    expect(screen.queryByText('И')).toBeNull()
  })

  it('у предыдущих сообщений того же автора (null) аватара нет, но место под него оставлено', () => {
    const { container } = render(<MessageBubble message={message} mine={false} senderName="Игорь" showSender senderAvatar={null} />)
    expect(screen.queryByText('И')).toBeNull()
    // колонка аватара пустая, но на месте: сообщения стоят в один столбец
    expect(container.firstElementChild?.childElementCount).toBe(2)
  })

  it('без senderAvatar (свои сообщения, личные чаты) колонки аватара нет', () => {
    const { container } = render(<MessageBubble message={message} mine={false} senderName="Игорь" showSender={false} />)
    expect(screen.queryByText('И')).toBeNull()
    expect(container.firstElementChild?.getAttribute('data-message-id')).toBe('m1')
  })
})
