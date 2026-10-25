import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseMessage } from '../../src/contract.js'

const sample = JSON.parse(readFileSync(new URL('../../../contracts/realtime-v1.json', import.meta.url), 'utf8'))

describe('разбор сообщения канала', () => {
  it('образцы контракта разбираются как есть', () => {
    expect(parseMessage(JSON.stringify(sample.family))).toEqual(sample.family)
    expect(parseMessage(JSON.stringify(sample.member))).toEqual(sample.member)
    expect(parseMessage(JSON.stringify(sample.session))).toEqual(sample.session)
  })

  it('непонятное пропускается без ошибки', () => {
    expect(parseMessage(undefined)).toBeNull()
    expect(parseMessage('не json')).toBeNull()
    expect(parseMessage('null')).toBeNull()
    expect(parseMessage('[]')).toBeNull()
    // версия новее, чем понимает сервис
    expect(parseMessage(JSON.stringify({ ...sample.family, v: 2 }))).toBeNull()
    // нет адресата, адресат неизвестного вида, нет события
    expect(parseMessage(JSON.stringify({ v: 1, to: 'family', event: { type: 'tasks' } }))).toBeNull()
    expect(parseMessage(JSON.stringify({ v: 1, to: 'everyone', id: 'x', event: { type: 'tasks' } }))).toBeNull()
    expect(parseMessage(JSON.stringify({ v: 1, to: 'family', id: 'x' }))).toBeNull()
    expect(parseMessage(JSON.stringify({ v: 1, to: 'family', id: 'x', event: { type: 5 } }))).toBeNull()
  })
})
