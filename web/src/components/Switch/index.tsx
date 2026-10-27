import type { InputHTMLAttributes, ReactNode } from 'react'
import { Input, Label, Text, Thumb, Track } from './styles'

// Переключатель-«слайдер» (включено/выключено) с подписью; работает как флажок, для скринридеров это switch
export function Switch({ children, hint, ...props }: { children: ReactNode; hint?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'>) {
  return (
    <Label $disabled={!!props.disabled}>
      <Text>
        {children}
        {hint && <small>{hint}</small>}
      </Text>
      <Input type="checkbox" role="switch" {...props} />
      <Track aria-hidden>
        <Thumb />
      </Track>
    </Label>
  )
}
