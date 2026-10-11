import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardViewport } from '@/lib/useKeyboardViewport'

// подставной visualViewport: тест меняет высоту и шлёт resize
class FakeViewport extends EventTarget {
  height: number
  constructor(height: number) {
    super()
    this.height = height
  }
  resizeTo(height: number) {
    this.height = height
    this.dispatchEvent(new Event('resize'))
  }
}

const root = document.documentElement

function setup(height = 800, innerHeight = 800) {
  const vv = new FakeViewport(height)
  vi.stubGlobal('visualViewport', vv)
  vi.stubGlobal('innerHeight', innerHeight)
  return vv
}

beforeEach(() => {
  root.style.removeProperty('--vvh')
  delete root.dataset.keyboard
})
afterEach(() => vi.unstubAllGlobals())

describe('useKeyboardViewport', () => {
  it('сразу записывает высоту видимой области; без клавиатуры атрибута нет', () => {
    setup(800)
    renderHook(() => useKeyboardViewport())
    expect(root.style.getPropertyValue('--vvh')).toBe('800px')
    expect(root.dataset.keyboard).toBeUndefined()
  })

  it('клавиатура открылась (видимая область заметно меньше окна): атрибут, высота и вызов onChange', () => {
    const vv = setup(800)
    const onChange = vi.fn()
    renderHook(() => useKeyboardViewport(onChange))
    onChange.mockClear()

    act(() => vv.resizeTo(450))
    expect(root.dataset.keyboard).toBe('')
    expect(root.style.getPropertyValue('--vvh')).toBe('450px')
    expect(onChange).toHaveBeenCalledTimes(1)

    act(() => vv.resizeTo(800))
    expect(root.dataset.keyboard).toBeUndefined()
  })

  it('небольшое изменение (панель адреса браузера) клавиатурой не считается', () => {
    const vv = setup(800)
    renderHook(() => useKeyboardViewport())
    act(() => vv.resizeTo(720))
    expect(root.dataset.keyboard).toBeUndefined()
    expect(root.style.getPropertyValue('--vvh')).toBe('720px')
  })

  it('при уходе со страницы всё убирается и подписка снимается', () => {
    const vv = setup(800)
    const { unmount } = renderHook(() => useKeyboardViewport())
    act(() => vv.resizeTo(450))
    unmount()
    expect(root.style.getPropertyValue('--vvh')).toBe('')
    expect(root.dataset.keyboard).toBeUndefined()
    vv.resizeTo(300)
    expect(root.dataset.keyboard).toBeUndefined()
  })

  it('без visualViewport ничего не делает', () => {
    vi.stubGlobal('visualViewport', null)
    expect(() => renderHook(() => useKeyboardViewport())).not.toThrow()
    expect(root.style.getPropertyValue('--vvh')).toBe('')
  })

  it('onChange берётся из последнего рендера', () => {
    const vv = setup(800)
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useKeyboardViewport(cb), { initialProps: { cb: first } })
    rerender({ cb: second })
    first.mockClear()
    act(() => vv.resizeTo(500))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalled()
  })
})
