// Файлы в чате (документы, архивы и т. п.). Предел и список запрещённого повторяют сервер, чтобы человек сразу видел причину, а не
// ждал загрузки; настоящую проверку всё равно делает сервер.

export const MAX_FILES = 5
export const MAX_FILE_BYTES = 50 * 1024 * 1024

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'msc', 'dll', 'sys', 'lnk', 'reg', 'hta', 'jar', 'apk', 'ipa', 'app', 'dmg',
  'pkg', 'deb', 'rpm', 'iso', 'vbs', 'vbe', 'js', 'jse', 'mjs', 'wsf', 'wsh', 'ps1', 'psm1', 'sh', 'bash', 'zsh', 'command',
  'html', 'htm', 'xhtml', 'mht', 'mhtml', 'svg',
])

export const isBlockedFileName = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && BLOCKED_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}

// «532 Б», «48 КБ», «3,2 МБ»
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  const mb = bytes / (1024 * 1024)
  return `${(mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10).toString().replace('.', ',')} МБ`
}

// Почему файл нельзя отправить (текст для человека) или null, если можно.
export function fileProblem(file: { name: string; size: number }): string | null {
  if (file.size === 0) return 'Файл пустой.'
  if (file.size > MAX_FILE_BYTES) return `Файл больше ${MAX_FILE_BYTES / (1024 * 1024)} МБ.`
  if (isBlockedFileName(file.name)) return 'Такие файлы отправлять нельзя.'
  return null
}
