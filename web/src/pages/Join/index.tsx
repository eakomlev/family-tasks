import { useSearchParams } from 'react-router-dom'
import { BackLink } from '@/components/BackLink'
import { Page } from '@/components/Page'
import { EnterCode } from './components/EnterCode'
import { JoinWithCode } from './components/JoinWithCode'

export default function Join() {
  const [params] = useSearchParams()
  const code = params.get('code')

  return (
    <Page>
      <BackLink to="/">← Назад</BackLink>
      <h1>Присоединиться к семье</h1>
      {code ? <JoinWithCode key={code} code={code} /> : <EnterCode />}
    </Page>
  )
}
