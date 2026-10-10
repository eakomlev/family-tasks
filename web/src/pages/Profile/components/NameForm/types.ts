export interface NameFormProps {
  // текущее имя на сервере
  name: string
  // должен бросить, если сохранить не удалось
  onSave: (name: string) => Promise<void>
}
