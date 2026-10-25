// Токены дизайна «Квест». Значения те же, что в `web/src/components/GlobalStyle` (там CSS-переменные --bg, --accent и т. д.);
// новый цвет добавляйте в обе палитры. Тени в React Native устроены иначе, поэтому здесь только цвета.
export interface Palette {
  bg: string
  surface: string
  text: string
  muted: string
  border: string
  accent: string
  accentText: string
  accentSoft: string
  error: string
  success: string
  onError: string
  warningBg: string
  // «Квест»: лайм для действий и выполненного, золото для монет
  lime: string
  onLime: string
  coin: string
  coinBg: string
  coinText: string
  doneBg: string
  doneText: string
  reviewBg: string
  reviewText: string
  // зоны «Моего дня»: нужно решить, мой день, дети, игры (подложка значка, значок и название, цветная линия)
  zoneDecideBg: string
  zoneDecideFg: string
  zoneDecideLine: string
  zoneMineBg: string
  zoneMineFg: string
  zoneMineLine: string
  zoneKidsBg: string
  zoneKidsFg: string
  zoneKidsLine: string
  zoneGamesBg: string
  zoneGamesFg: string
  zoneGamesLine: string
  cardBorder: string
  track: string
  checkBorder: string
  // яркий блок прогресса на «Моём дне»
  heroBg: string
  heroBorder: string
  heroText: string
  heroMuted: string
  heroTrack: string
  // панель табов: тёмная «таблетка», выбранный таб лаймовый
  tabbarBg: string
  tabbarBorder: string
  tabbarIcon: string
  // выбранный таб: подложка и значок с подписью
  tabbarActiveBg: string
  tabbarActiveText: string
  // цвета видов записей семейного календаря
  calEvent: string
  calTask: string
  calBirthday: string
  calTraining: string
  calHoliday: string
  // фон экранов входа
  authA: string
  authB: string
  authC: string
  authCard: string
}

export const lightPalette: Palette = {
  bg: '#f5f6fb',
  surface: '#ffffff',
  text: '#14162b',
  muted: '#6b7090',
  border: '#e6e8f2',
  accent: '#4b3bff',
  accentText: '#ffffff',
  accentSoft: '#e9e6ff',
  error: '#d32f2f',
  success: '#3e8e00',
  onError: '#ffffff',
  warningBg: '#fff3cf',
  lime: '#c4f04a',
  onLime: '#1f2e00',
  coin: '#ffc233',
  coinBg: '#fff4d6',
  coinText: '#7a4b00',
  doneBg: '#e9fbc4',
  doneText: '#3e5b00',
  reviewBg: '#e6e3ff',
  reviewText: '#3424c9',
  zoneDecideBg: '#ffe0d6',
  zoneDecideFg: '#8a2d12',
  zoneDecideLine: '#e5532d',
  zoneMineBg: '#e7e4ff',
  zoneMineFg: '#3a2ec4',
  zoneMineLine: '#4b3bff',
  zoneKidsBg: '#d6f5e6',
  zoneKidsFg: '#0b5b3a',
  zoneKidsLine: '#13a06a',
  zoneGamesBg: '#ffebc7',
  zoneGamesFg: '#7a4500',
  zoneGamesLine: '#d98a00',
  cardBorder: '#eceef6',
  track: '#eef0fa',
  checkBorder: '#c3c8e3',
  heroBg: '#4b3bff',
  heroBorder: 'transparent',
  heroText: '#ffffff',
  heroMuted: '#dcd7ff',
  heroTrack: 'rgba(255, 255, 255, 0.22)',
  tabbarBg: '#ffffff',
  tabbarBorder: '#e6e8f2',
  tabbarIcon: '#7a7fa0',
  tabbarActiveBg: '#e9e6ff',
  tabbarActiveText: '#4b3bff',
  calEvent: '#4b3bff',
  calTask: '#d97706',
  calBirthday: '#db2777',
  calTraining: '#0d9488',
  calHoliday: '#dc2626',
  authA: '#d9d4ff',
  authB: '#e3e8ff',
  authC: '#e9fbc4',
  authCard: 'rgba(255, 255, 255, 0.8)',
}

export const darkPalette: Palette = {
  bg: '#0b0e1f',
  surface: '#161a33',
  text: '#eef0ff',
  muted: '#9aa0c7',
  border: '#2a2f55',
  accent: '#7b6cff',
  accentText: '#ffffff',
  accentSoft: '#24206b',
  error: '#ff8a80',
  success: '#c4f04a',
  onError: '#2a0a08',
  warningBg: '#3a2e08',
  lime: '#c4f04a',
  onLime: '#1f2e00',
  coin: '#ffc233',
  coinBg: '#3a2e08',
  coinText: '#ffd66b',
  doneBg: '#2b3a0b',
  doneText: '#c4f04a',
  reviewBg: '#24206b',
  reviewText: '#b9b2ff',
  zoneDecideBg: '#5c2214',
  zoneDecideFg: '#ffc4b0',
  zoneDecideLine: '#ff8a66',
  zoneMineBg: '#2a2670',
  zoneMineFg: '#c9c3ff',
  zoneMineLine: '#8e82ff',
  zoneKidsBg: '#0f4a33',
  zoneKidsFg: '#a9ebcb',
  zoneKidsLine: '#3dd598',
  zoneGamesBg: '#5a3a06',
  zoneGamesFg: '#ffd58a',
  zoneGamesLine: '#ffb933',
  cardBorder: '#262b4d',
  track: '#262b4d',
  checkBorder: '#3d4372',
  heroBg: '#1d1a5e',
  heroBorder: '#3a33a8',
  heroText: '#ffffff',
  heroMuted: '#b9b2ff',
  heroTrack: '#2e2a86',
  tabbarBg: '#1a1f3d',
  tabbarBorder: '#2c3260',
  tabbarIcon: '#9aa0c7',
  tabbarActiveBg: '#f2b94b',
  tabbarActiveText: '#2b1a00',
  calEvent: '#8f84ff',
  calTask: '#fbbf24',
  calBirthday: '#f472b6',
  calTraining: '#2dd4bf',
  calHoliday: '#f87171',
  authA: '#1d1a5e',
  authB: '#161a33',
  authC: '#0b0e1f',
  authCard: 'rgba(22, 26, 51, 0.78)',
}
