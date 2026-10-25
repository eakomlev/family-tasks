import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { spool, TooLarge } from '../../src/spool.js'

const uploadDirs = () => readdirSync(tmpdir()).filter((n) => n.startsWith('upload-'))

describe('приём тела во временный файл', () => {
  it('складывает тело потоком на диск и сообщает размер; cleanup убирает файл', async () => {
    const chunks = [Buffer.alloc(1000, 1), Buffer.alloc(2000, 2), Buffer.alloc(500, 3)]
    const spooled = await spool(Readable.from(chunks), 10_000)
    expect(spooled.size).toBe(3500)
    expect(readFileSync(spooled.path).equals(Buffer.concat(chunks))).toBe(true)
    await spooled.cleanup()
    expect(existsSync(spooled.path)).toBe(false)
  })

  it('больше предела: TooLarge, временных файлов не остаётся', async () => {
    const before = uploadDirs().length
    // тело дочитывается до конца (его нельзя обрывать, иначе клиент не получит 413), на диск лишнее не пишется
    const body = Readable.from(Array.from({ length: 10 }, () => Buffer.alloc(400, 1)))
    await expect(spool(body, 1000)).rejects.toBeInstanceOf(TooLarge)
    expect(body.readableEnded).toBe(true)
    expect(uploadDirs().length).toBe(before)
  })

  it('пустое тело даёт размер 0', async () => {
    const spooled = await spool(Readable.from([]), 100)
    expect(spooled.size).toBe(0)
    await spooled.cleanup()
  })

  it('обрыв потока: ошибка наружу, временные файлы убраны', async () => {
    const before = uploadDirs().length
    const body = new Readable({
      read() {
        this.push(Buffer.alloc(10, 1))
        this.destroy(new Error('соединение оборвано'))
      },
    })
    await expect(spool(body, 1000)).rejects.toThrow('соединение оборвано')
    expect(uploadDirs().length).toBe(before)
  })
})
