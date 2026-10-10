export interface EmailStepProps {
  email: string
  busy: boolean
  error?: string
  onEmailChange: (email: string) => void
  onSubmit: () => void
}
