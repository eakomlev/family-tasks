// Кто сейчас вошёл: токен нужен базовому запросу RTK Query. Значение выставляет SessionSync, когда вход прочитан из IndexedDB;
// модуль простой (не состояние Redux), чтобы токен не попадал в состояние и в сохранённый кэш.
export interface Session {
  token: string
  memberId: string
}

let current: Session | undefined

export const setSession = (session: Session | undefined) => {
  current = session
}

export const getSession = () => current
