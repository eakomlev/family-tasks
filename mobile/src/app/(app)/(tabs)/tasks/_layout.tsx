import { Stack } from 'expo-router'

// Раздел «Задания»: список, просмотр, создание и изменение друг над другом (кнопка «назад» возвращает к списку)
export default function TasksLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
