import { logout } from '@/api'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { CoinBalanceCard } from '@/components/CoinBalance'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { MenuLink } from '@/components/MenuLink'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { ageFromBirthDate, formatAge, formatBirthDate } from '@/lib/date'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { Badge, EditLink, Facts, Header, Hero, LogoutBox, Menu } from './styles'

// Профиль кратко: фото, имя, роль, дата рождения и email; ниже пункты (расписания у детей, уведомления, тема) и «Выйти».
// Править имя, дату рождения и фото: «Изменить» справа сверху.
export default function Profile() {
  const { identity, clear } = useIdentity()
  const confirm = useConfirm()
  const { data } = useProfile()

  if (!identity) return null
  const token = identity.token

  async function handleLogout() {
    const ok = await confirm({
      title: 'Выйти из аккаунта?',
      message: 'На этом устройстве вы выйдете из семьи. Вернуться можно, войдя по email.',
      confirmLabel: 'Выйти',
      danger: true,
    })
    if (!ok) return
    // даже если сервер недоступен, на этом устройстве всё равно выходим
    await logout(token).catch(() => {})
    await clear()
  }

  const me = data?.me

  return (
    <Page>
      <Header>
        <h1>Профиль</h1>
        {me && <EditLink to="/profile/edit">Изменить</EditLink>}
      </Header>
      {!me && <p>Загрузка…</p>}
      {me && (
        <>
          <Hero>
            <Avatar name={me.name} seed={me.id} src={me.avatar} size="6rem" />
            <h2>{me.name}</h2>
            <Badge>{ROLE_LABELS[me.role]}</Badge>
          </Hero>
          <Facts>
            {me.birthDate && <li>{formatBirthDate(me.birthDate)} · {formatAge(ageFromBirthDate(me.birthDate))}</li>}
            <li>{me.email}</li>
          </Facts>

          {/* у ребёнка: монеты и переход к истории начислений */}
          {me.coins !== undefined && <CoinBalanceCard coins={me.coins} to="/coins" />}

          <Menu aria-label="Разделы профиля">
            {me.role === 'child' && (
              <>
                <MenuLink to="/profile/schedule">Расписание уроков</MenuLink>
                <MenuLink to="/profile/trainings">Расписание тренировок</MenuLink>
              </>
            )}
            <MenuLink to="/profile/notifications">Уведомления</MenuLink>
            <MenuLink to="/profile/theme">Тема</MenuLink>
          </Menu>
        </>
      )}

      <LogoutBox>
        <Button type="button" onClick={handleLogout}>Выйти</Button>
      </LogoutBox>
    </Page>
  )
}
