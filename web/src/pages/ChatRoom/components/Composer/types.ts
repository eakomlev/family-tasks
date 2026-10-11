export interface ComposerProps {
  // отправляет текст; должен бросить ошибку, если не вышло (текст тогда остаётся в поле)
  onSend: (text: string) => Promise<void>
}
