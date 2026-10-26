import { useSearchParams } from 'react-router-dom'
import { AuthCard, AuthPage } from '@/components/AuthPage'
import { BackLink } from '@/components/BackLink'
import { EnterCode } from './components/EnterCode'
import { JoinWithCode } from './components/JoinWithCode'

export default function Join() {
  const [params] = useSearchParams()
  const code = params.get('code')

  return (
    <AuthPage>
      <BackLink to="/">← Назад</BackLink>
      <h1>Присоединиться к семье</h1>
      <AuthCard>
        {code ? <JoinWithCode key={code} code={code} /> : <EnterCode />}
      </AuthCard>
    </AuthPage>
  )
}
