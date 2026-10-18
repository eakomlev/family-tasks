import type { ImageSourcePropType } from 'react-native'

export interface Slide {
  image: ImageSourcePropType
  alt: string
  title: string
  text: string
}

// Пять слайдов с настоящими экранами приложения (картинки лежат в assets/onboarding, данные демонстрационные)
export const SLIDES: Slide[] = [
  {
    image: require('../../../assets/onboarding/day.jpg'),
    alt: 'Экран «Мой день»: прогресс дня, задания и баланс монет',
    title: 'Мой день',
    text: 'Задания, уроки и тренировки на сегодня на одном экране. Ничего не забудется.',
  },
  {
    image: require('../../../assets/onboarding/tasks.jpg'),
    alt: 'Экран «Задания» с заданиями на проверку',
    title: 'Задания с наградой',
    text: 'Поручайте дела, ребёнок отправляет их на проверку, вы подтверждаете и выдаёте монеты.',
  },
  {
    image: require('../../../assets/onboarding/coins.jpg'),
    alt: 'Экран «Монеты» с целями ребёнка',
    title: 'Монеты и мечты',
    text: 'Монеты копятся на цели: LEGO, велосипед или поход в кино. Видно, сколько осталось.',
  },
  {
    image: require('../../../assets/onboarding/chat.jpg'),
    alt: 'Семейный чат с реакциями и монетами за сообщения',
    title: 'Семейный чат',
    text: 'Общий чат и личные переписки. Отвечайте реакциями и дарите монеты за добрые слова.',
  },
  {
    image: require('../../../assets/onboarding/kids.jpg'),
    alt: 'Расписание уроков, тренировки и задания детей',
    title: 'Всё о детях',
    text: 'Уроки, тренировки и задания каждого ребёнка. Напоминания придут вовремя.',
  },
]
