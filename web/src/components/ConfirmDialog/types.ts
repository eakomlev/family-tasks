export interface ConfirmOptions {
  title: string
  // пояснение под заголовком
  message?: string
  confirmLabel: string
  // по умолчанию «Отмена»
  cancelLabel?: string
  // опасное действие (удаление, выход): кнопка подтверждения красная
  danger?: boolean
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>
