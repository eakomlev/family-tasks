// Копирование текста в буфер обмена. Асинхронный API есть не везде (нужен https и разрешение), поэтому запасной путь через скрытое поле.
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // пробуем запасной способ
  }
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  try {
    if (!document.execCommand('copy')) throw new Error('copy_failed')
  } finally {
    document.body.removeChild(field)
  }
}
