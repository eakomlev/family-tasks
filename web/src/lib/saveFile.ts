// Сохранение файла без ухода со страницы: на телефоне ссылка с download открывала саму картинку или файл в этом же окне приложения,
// а выйти оттуда было нечем (у установленного приложения нет кнопки «назад»). Поэтому файл берём запросом (фото идут через кэш
// фото) и отдаём системе: меню «Поделиться» (на iPhone там «Сохранить изображение» и «Сохранить в Файлы») или скачивание из памяти.
export async function saveFile(url: string, name: string, fallbackType = 'application/octet-stream'): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('download_failed')
  const blob = await res.blob()
  const file = new File([blob], name, { type: blob.type && blob.type !== 'application/octet-stream' ? blob.type : fallbackType })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      // человек закрыл меню: это не ошибка
      if ((err as Error).name === 'AbortError') return
    }
  }
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10_000)
}
