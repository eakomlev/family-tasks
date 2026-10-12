import { createContext, useContext } from 'react'

// Сколько заданий ждёт действия от меня: число на значке таба «Задачи».
export const TaskBadgeContext = createContext(0)

export const useTaskBadge = () => useContext(TaskBadgeContext)
