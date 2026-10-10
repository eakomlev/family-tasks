export interface CodeStepProps {
  email: string
  busy: boolean
  error?: string
  submitLabel: string
  onSubmit: (code: string) => void
  onResend: () => Promise<void>
  onChangeEmail: () => void
}
