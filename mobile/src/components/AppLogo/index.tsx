import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

// Логотип: золотой контур дома с тёплым светом в двери на тёмном фоне (как значок приложения, рисунок из web/public/icon.svg в масштабе 1:8)
export function AppLogo({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1c2150" />
          <Stop offset="1" stopColor="#07081c" />
        </LinearGradient>
        <LinearGradient id="logoGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffe29a" />
          <Stop offset="1" stopColor="#d9922e" />
        </LinearGradient>
        <RadialGradient id="logoGlow" cx="0.5" cy="0.62" r="0.5">
          <Stop offset="0" stopColor="#ffcf70" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#ffcf70" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="64" height="64" rx="14" fill="url(#logoBg)" />
      <Rect width="64" height="64" rx="14" fill="url(#logoGlow)" />
      <Path d="M32 14 12 31.25H17.5V49.5H46.5V31.25H52Z" fill="#0d1030" stroke="url(#logoGold)" strokeWidth="2.75" strokeLinejoin="round" />
      <Rect x="26.5" y="35.25" width="11" height="14.25" rx="5.5" fill="#ffd477" />
    </Svg>
  )
}
