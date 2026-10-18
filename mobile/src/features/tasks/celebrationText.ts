export const PRAISES = ['Молодец!', 'Отличная работа!', 'Так держать!', 'Супер!', 'Ура, готово!']

export const EMOJIS = ['🎉', '🏆', '🌟', '🥳']

export const pick = <T,>(items: T[], random: () => number = Math.random): T => items[Math.floor(random() * items.length)]
