import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../../src/app.js'
import { directKey } from '../../src/chat.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let outsider: TestFamily
let endpoints: Record<'mom' | 'dad' | 'kid' | 'sis', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  outsider = await createFamily()
  endpoints = {
    mom: await subscribe(fam.mom.id),
    dad: await subscribe(fam.dad.id),
    kid: await subscribe(fam.kid.id),
    sis: await subscribe(fam.sis.id),
  }
})
beforeEach(async () => {
  await resetSent()
})
afterAll(async () => {
  await removeFamilies(fam.id, outsider.id)
  await app.close()
  await pool.end()
})

const send = (token: string, chat: string, text: string) => api(app, token, 'POST', `/api/chats/${chat}/messages`, { text })
const messages = (token: string, chat: string, query = '') => api(app, token, 'GET', `/api/chats/${chat}/messages${query}`)
const list = async (token: string) => (await api(app, token, 'GET', '/api/chats')).body.chats as { id: string; last: any; unread: number }[]
// уведомления уходят в фоне, после ответа
const pushes = async (...who: (keyof typeof endpoints)[]) => {
  await new Promise((r) => setTimeout(r, 150))
  return (await sentTo(who.map((w) => endpoints[w])))
}

describe('directKey', () => {
  it('одинаковый для обоих собеседников', () => {
    expect(directKey('b', 'a')).toBe(directKey('a', 'b'))
    expect(directKey('a', 'b')).toBe('a:b')
  })
})

describe('список чатов', () => {
  it('у каждого общий чат и по одному на каждого другого участника, себя в списке нет', async () => {
    const chats = await list(fam.kid.token)
    expect(chats.map((c) => c.id).sort()).toEqual(['family', fam.mom.id, fam.dad.id, fam.sis.id].sort())
    expect(chats.every((c) => c.last === null && c.unread === 0)).toBe(true)
  })

  it('без сообщений: общий первым, затем по имени', async () => {
    const other = await createFamily()
    try {
      const chats = await list(other.mom.token)
      expect(chats[0].id).toBe('family')
      expect(chats.slice(1).map((c) => c.id)).toEqual([other.kid.id, other.dad.id, other.sis.id].sort((a, b) => {
        const name = (id: string) => (id === other.kid.id ? 'Ребёнок' : id === other.dad.id ? 'Папа' : 'Сестра')
        return name(a).toLowerCase().localeCompare(name(b).toLowerCase())
      }))
    } finally {
      await removeFamilies(other.id)
    }
  })

  it('без авторизации 401', async () => {
    expect((await api(app, null, 'GET', '/api/chats')).status).toBe(401)
  })
})

describe('сортировка по последней активности', () => {
  it('чат с самым свежим сообщением поднимается наверх, чаты без сообщений остаются внизу', async () => {
    const f = await createFamily()
    try {
      await send(f.mom.token, f.dad.id, 'раз')
      await new Promise((r) => setTimeout(r, 15))
      await send(f.mom.token, 'family', 'два')
      await new Promise((r) => setTimeout(r, 15))
      await send(f.kid.token, f.mom.id, 'три')

      const chats = await list(f.mom.token)
      expect(chats.slice(0, 3).map((c) => c.id)).toEqual([f.kid.id, 'family', f.dad.id])
      expect(chats[0].last.text).toBe('три')
      expect(chats[3].last).toBeNull()
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('отправка и чтение', () => {
  it('сообщение в общий чат видят все участники семьи', async () => {
    const sent = await send(fam.mom.token, 'family', '  Всем привет!  ')
    expect(sent.status).toBe(201)
    expect(sent.body.message).toMatchObject({ senderId: fam.mom.id, text: 'Всем привет!' })
    expect(sent.body.message.id).toBeTruthy()

    for (const t of [fam.mom, fam.dad, fam.kid, fam.sis]) {
      const got = await messages(t.token, 'family')
      expect(got.body.messages.at(-1).text).toBe('Всем привет!')
    }
  })

  it('личное сообщение видно обоим собеседникам и больше никому', async () => {
    await send(fam.kid.token, fam.mom.id, 'мам, привет')
    expect((await messages(fam.mom.token, fam.kid.id)).body.messages.at(-1).text).toBe('мам, привет')
    expect((await messages(fam.kid.token, fam.mom.id)).body.messages.at(-1).text).toBe('мам, привет')
    // у третьих это другие чаты: ни у папы с ребёнком, ни у сестры с мамой этого сообщения нет
    expect((await messages(fam.dad.token, fam.kid.id)).body.messages).toEqual([])
    expect((await messages(fam.sis.token, fam.mom.id)).body.messages).toEqual([])
    expect((await list(fam.dad.token)).find((c) => c.id === fam.kid.id)!.last).toBeNull()
  })

  it('сообщения идут по порядку, текст с переносами сохраняется', async () => {
    const f = await createFamily()
    try {
      await send(f.mom.token, 'family', 'первое')
      await send(f.dad.token, 'family', 'второе\nв две строки')
      const got = await messages(f.kid.token, 'family')
      expect(got.body.messages.map((m: { text: string }) => m.text)).toEqual(['первое', 'второе\nв две строки'])
      expect(got.body.hasMore).toBe(false)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('текст хранится как есть, без разметки', async () => {
    const f = await createFamily()
    try {
      await send(f.mom.token, 'family', '<script>alert(1)</script> & "кавычки"')
      expect((await messages(f.dad.token, 'family')).body.messages[0].text).toBe('<script>alert(1)</script> & "кавычки"')
    } finally {
      await removeFamilies(f.id)
    }
  })

  describe('отклоняет', () => {
    it.each([
      ['пустой текст', ''],
      ['только пробелы', '   \n  '],
    ])('%s', async (_name, text) => {
      expect((await send(fam.mom.token, 'family', text)).status).toBe(400)
    })

    it('слишком длинный текст, но ровно 2000 символов можно', async () => {
      expect((await send(fam.mom.token, 'family', 'я'.repeat(2001))).status).toBe(400)
      expect((await send(fam.mom.token, 'family', 'я'.repeat(2000))).status).toBe(201)
    })

    it('автор берётся из сессии: лишние поля игнорируются; текст не строкой отклоняется', async () => {
      const sent = await api(app, fam.mom.token, 'POST', '/api/chats/family/messages', { text: 'x', senderId: fam.dad.id })
      expect(sent.body.message.senderId).toBe(fam.mom.id)
      expect((await api(app, fam.mom.token, 'POST', '/api/chats/family/messages', { text: { a: 1 } })).status).toBe(400)
      expect((await api(app, fam.mom.token, 'POST', '/api/chats/family/messages', {})).status).toBe(400)
    })

    it('чат с самим собой, с неизвестным и с участником чужой семьи', async () => {
      expect((await send(fam.mom.token, fam.mom.id, 'x')).status).toBe(400)
      expect((await send(fam.mom.token, '00000000-0000-4000-8000-000000000000', 'x')).status).toBe(404)
      expect((await send(fam.mom.token, outsider.mom.id, 'x')).status).toBe(404)
      expect((await messages(fam.mom.token, outsider.mom.id)).status).toBe(404)
    })

    it('некорректный адрес чата', async () => {
      expect((await send(fam.mom.token, 'nope', 'x')).status).toBe(400)
    })

    it('без авторизации', async () => {
      expect((await api(app, null, 'POST', '/api/chats/family/messages', { text: 'x' })).status).toBe(401)
      expect((await api(app, null, 'GET', '/api/chats/family/messages')).status).toBe(401)
      expect((await api(app, null, 'POST', '/api/chats/family/read')).status).toBe(401)
    })
  })

  it('чужая семья не видит общий чат', async () => {
    await send(fam.mom.token, 'family', 'только для своих')
    const got = await messages(outsider.mom.token, 'family')
    expect(got.body.messages.map((m: { text: string }) => m.text)).not.toContain('только для своих')
  })
})

describe('постраничная загрузка', () => {
  it('свежие сообщения первыми, более старые по before, без дублей и пропусков', async () => {
    const f = await createFamily()
    try {
      for (let i = 1; i <= 7; i++) await send(f.mom.token, 'family', `м${i}`)

      const page1 = await messages(f.dad.token, 'family', '?limit=3')
      expect(page1.body.messages.map((m: { text: string }) => m.text)).toEqual(['м5', 'м6', 'м7'])
      expect(page1.body.hasMore).toBe(true)

      const page2 = await messages(f.dad.token, 'family', `?limit=3&before=${page1.body.messages[0].id}`)
      expect(page2.body.messages.map((m: { text: string }) => m.text)).toEqual(['м2', 'м3', 'м4'])
      expect(page2.body.hasMore).toBe(true)

      const page3 = await messages(f.dad.token, 'family', `?limit=3&before=${page2.body.messages[0].id}`)
      expect(page3.body.messages.map((m: { text: string }) => m.text)).toEqual(['м1'])
      expect(page3.body.hasMore).toBe(false)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('before из другого чата игнорирует границу, параметры проверяются', async () => {
    expect((await messages(fam.mom.token, 'family', '?limit=0')).status).toBe(400)
    expect((await messages(fam.mom.token, 'family', '?limit=101')).status).toBe(400)
    expect((await messages(fam.mom.token, 'family', '?before=не-id')).status).toBe(400)
  })
})

describe('непрочитанное', () => {
  it('растёт у получателей, у автора нет; прочтение обнуляет только этот чат', async () => {
    const f = await createFamily()
    try {
      await send(f.mom.token, 'family', 'в общий')
      await send(f.mom.token, 'family', 'ещё в общий')
      await send(f.mom.token, f.dad.id, 'папе лично')

      const dad = await list(f.dad.token)
      expect(dad.find((c) => c.id === 'family')!.unread).toBe(2)
      expect(dad.find((c) => c.id === f.mom.id)!.unread).toBe(1)
      const mom = await list(f.mom.token)
      expect(mom.every((c) => c.unread === 0)).toBe(true)

      expect((await api(app, f.dad.token, 'POST', '/api/chats/family/read')).status).toBe(204)
      const after = await list(f.dad.token)
      expect(after.find((c) => c.id === 'family')!.unread).toBe(0)
      expect(after.find((c) => c.id === f.mom.id)!.unread).toBe(1)

      await send(f.mom.token, 'family', 'новое')
      expect((await list(f.dad.token)).find((c) => c.id === 'family')!.unread).toBe(1)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('ответ в чате считается прочтением: свои сообщения непрочитанными не бывают, чужие после ответа появляются снова', async () => {
    const f = await createFamily()
    try {
      await send(f.mom.token, f.kid.id, 'привет')
      expect((await list(f.kid.token)).find((c) => c.id === f.mom.id)!.unread).toBe(1)
      await send(f.kid.token, f.mom.id, 'привет!')
      expect((await list(f.kid.token)).find((c) => c.id === f.mom.id)!.unread).toBe(0)
      await new Promise((r) => setTimeout(r, 15))
      await send(f.mom.token, f.kid.id, 'как дела?')
      expect((await list(f.kid.token)).find((c) => c.id === f.mom.id)!.unread).toBe(1)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('сообщения, отправленные до появления участника, ему непрочитанными не показываются', async () => {
    const f = await createFamily()
    try {
      await send(f.mom.token, 'family', 'до новичка')
      await pool.query(`update messages set created_at = now() - interval '1 day' where family_id = $1`, [f.id])
      const { rows } = await pool.query(
        `insert into members (family_id, name, email, role) values ($1, 'Новичок', $2, 'child') returning id`,
        [f.id, `new-${f.id}@test.local`],
      )
      const { createSession } = await import('../../src/auth.js')
      const token = await createSession(pool, rows[0].id)
      expect((await list(token)).find((c) => c.id === 'family')!.unread).toBe(0)
      await send(f.mom.token, 'family', 'после новичка')
      expect((await list(token)).find((c) => c.id === 'family')!.unread).toBe(1)
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('отметки «прочитано»', () => {
  const readUpTo = async (token: string, chat: string) => (await messages(token, chat)).body.readUpTo as string | null
  const isRead = (up: string | null, createdAt: string) => up !== null && createdAt <= up

  it('личный чат: пока собеседник не открыл чат, сообщение «отправлено», после этого «прочитано»', async () => {
    const f = await createFamily()
    try {
      const sent = (await send(f.mom.token, f.kid.id, 'привет')).body.message
      expect(isRead(await readUpTo(f.mom.token, f.kid.id), sent.createdAt)).toBe(false)

      await api(app, f.kid.token, 'POST', `/api/chats/${f.mom.id}/read`)
      expect(isRead(await readUpTo(f.mom.token, f.kid.id), sent.createdAt)).toBe(true)

      // новое сообщение после прочтения снова «отправлено»
      await new Promise((r) => setTimeout(r, 15))
      const next = (await send(f.mom.token, f.kid.id, 'ещё')).body.message
      const up = await readUpTo(f.mom.token, f.kid.id)
      expect(isRead(up, sent.createdAt)).toBe(true)
      expect(isRead(up, next.createdAt)).toBe(false)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('общий чат: «прочитано», как только прочёл хотя бы один из остальных; своё прочтение не считается', async () => {
    const f = await createFamily()
    try {
      const sent = (await send(f.mom.token, 'family', 'всем')).body.message
      expect(isRead(await readUpTo(f.mom.token, 'family'), sent.createdAt)).toBe(false)
      // автор сам открыл чат: его сообщение от этого не «прочитано»
      await api(app, f.mom.token, 'POST', '/api/chats/family/read')
      expect(isRead(await readUpTo(f.mom.token, 'family'), sent.createdAt)).toBe(false)
      // прочёл один из троих остальных: этого достаточно, остальные могут и не открывать
      await api(app, f.dad.token, 'POST', '/api/chats/family/read')
      expect(isRead(await readUpTo(f.mom.token, 'family'), sent.createdAt)).toBe(true)
      // сообщение после прочтения снова «отправлено», пока его никто не открыл
      await new Promise((r) => setTimeout(r, 15))
      const next = (await send(f.mom.token, 'family', 'ещё')).body.message
      expect(isRead(await readUpTo(f.mom.token, 'family'), next.createdAt)).toBe(false)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('личные чаты независимы: прочтение третьим ничего не меняет', async () => {
    const f = await createFamily()
    try {
      const sent = (await send(f.mom.token, f.kid.id, 'тебе')).body.message
      await api(app, f.dad.token, 'POST', `/api/chats/${f.mom.id}/read`)
      await api(app, f.sis.token, 'POST', `/api/chats/${f.mom.id}/read`)
      expect(isRead(await readUpTo(f.mom.token, f.kid.id), sent.createdAt)).toBe(false)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('участник, пришедший позже, не задерживает «прочитано» для старых сообщений', async () => {
    const f = await createFamily()
    try {
      const sent = (await send(f.mom.token, 'family', 'до новичка')).body.message
      await new Promise((r) => setTimeout(r, 15))
      await pool.query(
        `insert into members (family_id, name, email, role) values ($1, 'Новичок', $2, 'child')`,
        [f.id, `late-${f.id}@test.local`],
      )
      for (const t of [f.dad, f.kid, f.sis]) await api(app, t.token, 'POST', '/api/chats/family/read')
      expect(isRead(await readUpTo(f.mom.token, 'family'), sent.createdAt)).toBe(true)
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('уведомления', () => {
  it('общий чат: всем, кроме автора; заголовок с именем и «Общий чат»', async () => {
    await send(fam.mom.token, 'family', 'Ужин готов')
    const got = await pushes('mom', 'dad', 'kid', 'sis')
    expect(got.map((g) => g.endpoint).sort()).toEqual([endpoints.dad, endpoints.kid, endpoints.sis].sort())
    expect(got[0].payload).toEqual({
      title: 'Мама · Общий чат',
      body: 'Ужин готов',
      url: '/chat/family',
      tag: 'chat-family',
    })
  })

  it('личный чат: только собеседнику, ссылка ведёт в чат с автором', async () => {
    await send(fam.kid.token, fam.mom.id, 'Мам, можно гулять?')
    const got = await pushes('mom', 'dad', 'kid', 'sis')
    expect(got).toHaveLength(1)
    expect(got[0].endpoint).toBe(endpoints.mom)
    expect(got[0].payload).toEqual({
      title: 'Ребёнок',
      body: 'Мам, можно гулять?',
      url: `/chat/${fam.kid.id}`,
      tag: `chat-${fam.kid.id}`,
    })
  })

  it('ребёнку родители приходят как «Мама» и «Папа», остальным по имени', async () => {
    const f = await createFamily()
    try {
      await pool.query(`update members set name = 'Лена' where id = $1`, [f.mom.id])
      await pool.query(`update members set name = 'Игорь' where id = $1`, [f.dad.id])
      const ep = { dad: await subscribe(f.dad.id), kid: await subscribe(f.kid.id), mom: await subscribe(f.mom.id) }
      const titles = async (...who: (keyof typeof ep)[]) => {
        await new Promise((r) => setTimeout(r, 150))
        return Object.fromEntries(await Promise.all(who.map(async (w) => [w, (await sentTo([ep[w]])).map((s) => s.payload.title)])))
      }

      // мама пишет в общий чат: ребёнок видит «Мама · Общий чат», папа «Лена · Общий чат»
      await send(f.mom.token, 'family', 'ужин')
      expect(await titles('dad', 'kid')).toEqual({ dad: ['Лена · Общий чат'], kid: ['Мама · Общий чат'] })

      // папа пишет ребёнку лично: «Папа»; ребёнок пишет папе: «Ребёнок» (дети друг для друга и для родителей по именам)
      await resetSent()
      await send(f.dad.token, f.kid.id, 'привет')
      expect(await titles('kid')).toEqual({ kid: ['Папа'] })
      await resetSent()
      await send(f.kid.token, f.dad.id, 'привет!')
      expect(await titles('dad')).toEqual({ dad: ['Ребёнок'] })

      // родитель родителю: по имени
      await resetSent()
      await send(f.mom.token, f.dad.id, 'купи хлеб')
      expect(await titles('dad')).toEqual({ dad: ['Лена'] })
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('длинный текст сокращается до одной строки', async () => {
    await send(fam.mom.token, fam.dad.id, `${'слово '.repeat(60)}\nконец`)
    const [got] = await pushes('dad')
    expect(got.payload.body).not.toContain('\n')
    expect(got.payload.body.length).toBeLessThanOrEqual(140)
    expect(got.payload.body.endsWith('…')).toBe(true)
  })

  it('неудачная отправка уведомлений не нужна', async () => {
    expect((await send(fam.mom.token, 'family', '   ')).status).toBe(400)
    expect(await pushes('dad', 'kid', 'sis')).toEqual([])
  })
})

describe('пуш не нужен, если чат открыт', () => {
  const view = async (token: string, chat: string | null) => {
    const ws = await app.injectWS('/api/ws')
    const ready = new Promise<void>((r) => ws.once('message', () => r()))
    ws.send(JSON.stringify({ type: 'auth', token }))
    await ready
    ws.send(JSON.stringify({ type: 'viewing', chat }))
    await new Promise((r) => setTimeout(r, 100))
    return ws
  }

  it('открытый у получателя чат не получает уведомление, остальные получают', async () => {
    const ws = await view(fam.dad.token, 'family')
    try {
      expect((await send(fam.mom.token, 'family', 'всем привет')).status).toBe(201)
      expect(await pushes('dad')).toEqual([])
      expect((await pushes('kid')).length).toBe(1)
    } finally {
      ws.terminate()
    }
  })

  it('другой чат или null уведомление не гасят', async () => {
    const ws = await view(fam.dad.token, fam.kid.id)
    try {
      await send(fam.mom.token, 'family', 'раз')
      expect((await pushes('dad')).length).toBe(1)
      ws.send(JSON.stringify({ type: 'viewing', chat: null }))
    } finally {
      ws.terminate()
    }
  })
})

describe('визиты в личный чат', () => {
  const peerOf = async (token: string, chat: string) => (await messages(token, chat)).body.peer
  const open = async (token: string, chat: string) => {
    const ws = await app.injectWS('/api/ws')
    const ready = new Promise<void>((r) => ws.once('message', () => r()))
    ws.send(JSON.stringify({ type: 'auth', token }))
    await ready
    ws.send(JSON.stringify({ type: 'viewing', chat }))
    await new Promise((r) => setTimeout(r, 100))
    return ws
  }

  it('собеседник видит, что мама сейчас в чате, а после выхода время визита', async () => {
    expect(await peerOf(fam.dad.token, fam.mom.id)).toEqual({ viewing: false, lastVisitAt: null })
    const ws = await open(fam.mom.token, fam.dad.id)
    expect(await peerOf(fam.dad.token, fam.mom.id)).toMatchObject({ viewing: true })
    ws.send(JSON.stringify({ type: 'viewing', chat: null }))
    await new Promise((r) => setTimeout(r, 100))
    const peer = await peerOf(fam.dad.token, fam.mom.id)
    expect(peer.viewing).toBe(false)
    expect(peer.lastVisitAt).not.toBeNull()
    ws.terminate()
  })

  it('в общем чате подписи нет', async () => {
    expect(await peerOf(fam.dad.token, 'family')).toBeNull()
  })
})
