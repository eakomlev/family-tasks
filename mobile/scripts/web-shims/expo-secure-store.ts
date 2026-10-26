// Только для просмотра вёрстки в браузере (`npm run web:preview`): у `expo-secure-store` нет веб-версии, и вход падал при сохранении токена.
// Здесь токен лежит в localStorage: это небезопасно, поэтому заглушка подставляется только в веб-просмотре (metro.config.js),
// в сборках для телефона используется настоящий SecureStore.
export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value)
}

export async function deleteItemAsync(key: string): Promise<void> {
  localStorage.removeItem(key)
}
