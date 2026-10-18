import { useEffect, useState } from 'react'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { getInvite, type Link } from '@/api'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { LinkBox } from '@/components/LinkBox'
import { Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { inviteLink } from '@/lib/links'
import { retryRead } from '@/lib/retry'

// «Семья создана»: ссылка-приглашение для остальных. Если параметров нет (приложение открыли заново), приглашение запрашивается.
export default function FamilyCreated() {
  const { identity } = useIdentity()
  const router = useRouter()
  const params = useLocalSearchParams<{ code?: string; expiresAt?: string }>()
  const [invite, setInvite] = useState<Link | undefined>(
    params.code && params.expiresAt ? { code: params.code, expiresAt: params.expiresAt } : undefined,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (invite || !identity) return
    const controller = new AbortController()
    retryRead(() => getInvite(identity.token), controller.signal).then(setInvite).catch(() => setFailed(true))
    return () => controller.abort()
  }, [invite, identity])

  if (failed) return <Redirect href="/" />

  return (
    <AuthScreen>
      <Text $size={48}>🎉</Text>
      <Title>Семья создана!</Title>
      <Text>Отправьте эту ссылку тем, кого хотите пригласить.</Text>
      {invite ? <LinkBox link={inviteLink(invite.code)} expiresAt={invite.expiresAt} /> : <Text $tone="muted">Загрузка…</Text>}
      <Button variant="primary" onPress={() => router.replace('/')}>
        ОК
      </Button>
    </AuthScreen>
  )
}
