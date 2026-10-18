import Svg, { Path, Rect } from 'react-native-svg'

// Логотип: белый дом с галочкой на индиго (как значок приложения)
export function AppLogo({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="14" fill="#4f46e5" />
      <Path d="M32 15 13.25 30.75H20.25V47.75H43.75V30.75H50.75Z" fill="#fff" stroke="#fff" strokeWidth="5.5" strokeLinejoin="round" />
      <Path d="M24.5 38.5 30 44 40.3 32.8" fill="none" stroke="#4f46e5" strokeWidth="3.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
