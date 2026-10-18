import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

// безопасное имя для временного файла: без пути и служебных знаков
const safeName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'file'

// Сохранение фото и файлов из чата: скачиваем во временную папку и отдаём системному меню «Поделиться» (на iPhone там «Сохранить
// изображение» и «Сохранить в Файлы», на Android выбор приложения или папки). Экран при этом не уходит со страницы.
export async function saveRemoteFile(url: string, name: string): Promise<void> {
  const target = new File(Paths.cache, safeName(name))
  if (target.exists) target.delete()
  const file = await File.downloadFileAsync(url, target)
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable')
  await Sharing.shareAsync(file.uri)
}
