// Есть ли внизу экрана панель табов: она только на четырёх главных экранах (Мой день, Задачи, Чат, Семья). Все остальные экраны
// (задание, переписка, профиль, календарь…) лежат в общем стеке поверх табов, закрывают панель и возвращаются назад по стрелке или жесту.
// От этого зависит свободное место под контентом.
export const TAB_BAR_RESERVE = 88

export function tabBarVisible(pathname: string): boolean {
  return ['/', '/tasks', '/chat', '/family'].includes(pathname)
}

// Повторное нажатие на уже открытый таб: открытый экран прокручивается в начало
const reselectListeners = new Set<() => void>()

export function onTabReselect(listener: () => void): () => void {
  reselectListeners.add(listener)
  return () => void reselectListeners.delete(listener)
}

export function emitTabReselect() {
  reselectListeners.forEach((listener) => listener())
}
