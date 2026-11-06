import { Image } from 'react-native'

// Иконка приложения на экранах входа и знакомства
export function AppLogo({ size = 72 }: { size?: number }) {
  return <Image source={require('../../../assets/images/icon.png')} style={{ width: size, height: size }} />
}
