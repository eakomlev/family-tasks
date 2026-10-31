import { createContext, useContext, type ComponentRef, type RefObject } from 'react'
import type { View } from 'react-native'

export type TabBarBlurTarget = RefObject<ComponentRef<typeof View> | null>

interface TabBarBlurContextValue {
  target: TabBarBlurTarget | null
  setTarget: (target: TabBarBlurTarget | null) => void
}

export const TabBarBlurContext = createContext<TabBarBlurContextValue | null>(null)

export function useTabBarBlur() {
  return useContext(TabBarBlurContext)
}
