
// Наборы эмодзи для панели в поле ввода чата: у каждой категории значок-вкладка и список.
export interface EmojiCategory {
  key: string
  icon: string
  title: string
  items: string[]
}

const split = (s: string) => s.split(/\s+/).filter(Boolean)

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: 'smileys',
    icon: '😀',
    title: 'Смайлы',
    items: split(
      '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 👽 🤖',
    ),
  },
  {
    key: 'gestures',
    icon: '👍',
    title: 'Жесты',
    items: split(
      '👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐 🖖 👋 🤝 🙏 ✍️ 💪 🦾 🙌 👏 🤲 👐 🫶 🫰 🫵 👀 👂 👃 🧠 🦷 👄 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙋 🙆 🙅 🤷 🤦 💁 🙇',
    ),
  },
  {
    key: 'hearts',
    icon: '❤️',
    title: 'Сердца',
    items: split(
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ 💫 ⭐ 🌟 🔥 💥 💯 ✅ ❌ ❓ ❗ 💤 🎉 🎊 🎁 🏆 🥇 🥈 🥉 🎖 🏅 👑 💎 💰 🪙',
    ),
  },
  {
    key: 'animals',
    icon: '🐶',
    title: 'Животные',
    items: split(
      '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦉 🐺 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🦖 🐙 🦀 🐠 🐬 🐳 🦈 🐘 🦒 🦓 🐎 🐕 🐈 🌵 🌲 🌳 🌴 🌱 🌿 🍀 🌷 🌹 🌻 🌼 🌸 🍄',
    ),
  },
  {
    key: 'food',
    icon: '🍕',
    title: 'Еда',
    items: split(
      '🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥝 🍅 🥑 🥦 🥕 🌽 🥔 🍞 🥐 🧀 🥚 🍳 🥞 🥓 🍔 🍟 🌭 🍕 🥪 🌮 🌯 🍝 🍜 🍣 🍱 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 🍿 🥛 ☕ 🍵 🧃 🥤',
    ),
  },
  {
    key: 'activities',
    icon: '⚽',
    title: 'Активности',
    items: split(
      '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🥋 ⛸ 🎿 🏂 🏋️ 🤸 🤾 🏊 🚴 🏇 🧘 🎮 🕹 🎲 🧩 🎯 🎳 🎨 🎬 🎤 🎧 🎸 🎹 🥁 🎺 🎻 📚 ✏️ 📝 🖍 🎒 🏫',
    ),
  },
  {
    key: 'objects',
    icon: '🚗',
    title: 'Предметы',
    items: split(
      '🚗 🚕 🚌 🚓 🚑 🚒 🚲 🛴 🚂 ✈️ 🚀 🛸 ⛵ 🏠 🏡 🏫 ⏰ ⌚ 📱 💻 🖥 📷 📺 🔋 💡 🔑 🔒 🛒 🧸 🎈 🌈 ☀️ ⛅ ☁️ 🌧 ⚡ ❄️ ☃️ 🌙 🌍 🔔 📍 📌 ✂️ 📎 🧹 🧺',
    ),
  },
]

const RECENT_KEY = 'emoji-recent'
export const RECENT_LIMIT = 24

// Недавние: последние выбранные, самое свежее первым
export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, RECENT_LIMIT) : []
  } catch {
    return []
  }
}

export function pushRecent(current: string[], emoji: string): string[] {
  return [emoji, ...current.filter((e) => e !== emoji)].slice(0, RECENT_LIMIT)
}

export function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* хранилища нет — недавние просто не запомнятся */
  }
}

// Вставка в место курсора: возвращает новый текст и позицию курсора после вставки
export function insertAt(text: string, selection: { start: number; end: number }, insert: string) {
  const start = Math.min(selection.start, selection.end)
  const end = Math.max(selection.start, selection.end)
  return { text: text.slice(0, start) + insert + text.slice(end), cursor: start + insert.length }
}

const ZWJ = 0x200d
const isVariation = (cp: number) => cp === 0xfe0f || cp === 0xfe0e
const isSkinTone = (cp: number) => cp >= 0x1f3fb && cp <= 0x1f3ff

// «Стереть» перед курсором одну букву или целый эмодзи (склеенные через ZWJ, с цветом кожи и вариантом начертания считаются одним)
export function deleteBefore(text: string, selection: { start: number; end: number }) {
  const start = Math.min(selection.start, selection.end)
  const end = Math.max(selection.start, selection.end)
  if (start !== end) return { text: text.slice(0, start) + text.slice(end), cursor: start }
  if (start === 0) return { text, cursor: 0 }

  const chars = Array.from(text.slice(0, start))
  const cp = (c: string | undefined) => (c === undefined ? -1 : c.codePointAt(0)!)
  // сначала хвостовые модификаторы, потом сам знак; пока перед ним склейка ZWJ, забираем и предыдущий знак
  for (;;) {
    while (chars.length > 0 && (isVariation(cp(chars[chars.length - 1])) || isSkinTone(cp(chars[chars.length - 1])))) chars.pop()
    chars.pop()
    if (cp(chars[chars.length - 1]) === ZWJ) {
      chars.pop()
      continue
    }
    break
  }
  const head = chars.join('')
  return { text: head + text.slice(start), cursor: head.length }
}
