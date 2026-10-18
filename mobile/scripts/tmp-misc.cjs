const fs = require('fs')
const rd = (f) => {
  const s = fs.readFileSync(f, 'utf8')
  return { crlf: s.includes('\r\n'), s: s.replace(/\r\n/g, '\n') }
}
const wr = (f, o, s) => fs.writeFileSync(f, o.crlf ? s.replace(/\n/g, '\r\n') : s)
const must = (s, from, to) => {
  if (!s.includes(from)) throw new Error('нет фрагмента: ' + from.slice(0, 70))
  return s.replace(from, to)
}

// Одинокая стрелка «назад» тоже закреплена наверху
for (const f of ['src/features/family/MemberScreen.tsx', 'src/features/profile/ProfileEditScreen.tsx']) {
  const o = rd(f)
  let s = o.s
  s = s.replace(/<Screen>\n([ \t]*)(<BackLink [^\n]*<\/BackLink>)\n/g, (m, ind, link) => `<Screen header={${link}}>\n`)
  wr(f, o, s)
}

// Мой день: закреплённая шапка с календарём, приветствие на всю ширину без картинки, дата открывает календарь
let f = 'src/app/(app)/(tabs)/index.tsx'
let o = rd(f)
let s = o.s
s = must(
  s,
  `    <Screen

      refreshControl=`,
  `    <Screen
      header={
        // шапка закреплена: календарь слева, справа остаётся место под монеты и значок профиля
        <Pressable onPress={() => router.push('/calendar')} accessibilityRole="button" accessibilityLabel="Семейный календарь" hitSlop={8} style={{ alignSelf: 'flex-start', height: 38, justifyContent: 'center' }}>
          <Ionicons name="calendar-outline" size={30} color={colors.text} />
        </Pressable>
      }
      refreshControl=`,
)
s = s.replace(/        \{\/\* вход в семейный календарь \*\/\}\n        <Pressable[\s\S]*?<\/Pressable>\n/, '')
s = must(s, '<PageTitle style={{ flex: 1 }}>{`${greeting.icon} ${greeting.text}, ${identity?.name}!`}</PageTitle>', '<Title style={{ flex: 1 }}>{`${greeting.text}, ${identity?.name}!`}</Title>')
s = must(s, '        <Text $tone="muted">{formatToday(now)}</Text>', '        <Pressable onPress={() => router.push(\'/calendar\')} accessibilityRole="button" accessibilityLabel="Открыть календарь" hitSlop={6} style={{ alignSelf: \'flex-start\' }}>\n          <Text $tone="muted">{formatToday(now)}</Text>\n        </Pressable>')
wr(f, o, s)
