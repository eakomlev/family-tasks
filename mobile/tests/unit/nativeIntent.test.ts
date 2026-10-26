import { describe, expect, it } from 'vitest'
import { redirectSystemPath } from '../../src/app/+native-intent'

const open = (path: string) => redirectSystemPath({ path, initial: true })

describe('входящие ссылки', () => {
  it('ссылка-приглашение с сайта (Android App Links) превращается в путь с кодом', () => {
    expect(open('https://familytasks.ru/join?code=abc123')).toBe('/join?code=abc123')
    expect(open('https://familytasks.ru/join?code=a%2Fb&x=1')).toBe('/join?code=a%2Fb&x=1')
    expect(open('http://localhost:8080/join?code=dev')).toBe('/join?code=dev')
  })

  it('ссылка без параметров остаётся путём без «?»', () => {
    expect(open('https://familytasks.ru/join')).toBe('/join')
  })

  it('«Поделиться» ведёт на выбор чата', () => {
    expect(open('ru.familytasks.mobile://expo-sharing')).toBe('/share')
  })

  it('ссылка по схеме приложения и обычный путь остаются как есть', () => {
    expect(open('familytasks://join?code=abc')).toBe('familytasks://join?code=abc')
    expect(open('/chat/family')).toBe('/chat/family')
  })
})
