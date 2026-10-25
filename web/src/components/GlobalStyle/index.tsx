import { createGlobalStyle, css } from 'styled-components'

const lightColors = css`
  --bg: #f5f6fb;
  --surface: #fff;
  --text: #14162b;
  --muted: #6b7090;
  --border: #e6e8f2;
  --accent: #4b3bff;
  --accent-text: #fff;
  --accent-soft: #e9e6ff;
  --accent-shadow: 0 10px 22px rgb(75 59 255 / 0.3);
  --error: #d32f2f;
  --success: #3e8e00;
  --on-error: #fff;
  --warning-bg: #fff3cf;
  /* «Квест»: лайм для действий и выполненного, золото для монет */
  --lime: #c4f04a;
  --on-lime: #1f2e00;
  --coin: #ffc233;
  --coin-bg: #fff4d6;
  --coin-text: #7a4b00;
  --done-bg: #e9fbc4;
  --done-text: #3e5b00;
  --review-bg: #e6e3ff;
  --review-text: #3424c9;
  /* зоны «Моего дня»: нужно решить, мой день, дети, игры (значок и название, значок на плашке, цветная линия) */
  --zone-decide-bg: #ffe0d6;
  --zone-decide-fg: #8a2d12;
  --zone-decide-line: #e5532d;
  --zone-mine-bg: #e7e4ff;
  --zone-mine-fg: #3a2ec4;
  --zone-mine-line: #4b3bff;
  --zone-kids-bg: #d6f5e6;
  --zone-kids-fg: #0b5b3a;
  --zone-kids-line: #13a06a;
  --zone-games-bg: #ffebc7;
  --zone-games-fg: #7a4500;
  --zone-games-line: #d98a00;
  /* карточки: в светлой теме белые с мягкой тенью, в тёмной с тонкой рамкой */
  --card-border: #eceef6;
  --card-shadow: 0 6px 18px rgb(40 50 120 / 0.08);
  --radius-card: 1.35rem;
  --track: #eef0fa;
  --check-border: #c3c8e3;
  /* яркий блок прогресса на «Моём дне» */
  --hero-bg: #4b3bff;
  --hero-border: transparent;
  --hero-shadow: 0 14px 30px rgb(75 59 255 / 0.35);
  --hero-text: #fff;
  --hero-muted: #dcd7ff;
  --hero-track: rgb(255 255 255 / 0.22);
  /* панель табов: в светлой теме белая «таблетка», выбранный таб мягкий индиго */
  --tabbar-bg: #fff;
  --tabbar-border: #e6e8f2;
  --tabbar-shadow: 0 12px 28px rgb(40 50 120 / 0.14);
  --tabbar-icon: #7a7fa0;
  --tabbar-active-bg: #e9e6ff;
  --tabbar-active-text: #4b3bff;
  /* цвета видов записей семейного календаря */
  --cal-event: #4b3bff;
  --cal-task: #d97706;
  --cal-birthday: #db2777;
  --cal-training: #0d9488;
  --cal-holiday: #dc2626;
  /* стеклянные плашки (поле ввода чата) */
  --glass-bar: rgb(255 255 255 / 0.78);
  --glass-tint: rgb(75 59 255 / 0.12);
  --glass-edge: rgb(255 255 255 / 0.9);
  --glass-shade: rgb(40 50 120 / 0.14);
  --glass-ring: rgb(75 59 255 / 0.18);
  /* фон экранов входа */
  --auth-a: #d9d4ff;
  --auth-b: #e3e8ff;
  --auth-c: #e9fbc4;
  --auth-blob: rgb(255 255 255 / 0.55);
  --auth-card: rgb(255 255 255 / 0.8);
  color-scheme: light;
`

const darkColors = css`
  --bg: #0b0e1f;
  --surface: #161a33;
  --text: #eef0ff;
  --muted: #9aa0c7;
  --border: #2a2f55;
  --accent: #7b6cff;
  --accent-text: #fff;
  --accent-soft: #24206b;
  --accent-shadow: 0 10px 22px rgb(0 0 0 / 0.35);
  --error: #ff8a80;
  --success: #c4f04a;
  --on-error: #2a0a08;
  --warning-bg: #3a2e08;
  --lime: #c4f04a;
  --on-lime: #1f2e00;
  --coin: #ffc233;
  --coin-bg: #3a2e08;
  --coin-text: #ffd66b;
  --done-bg: #2b3a0b;
  --done-text: #c4f04a;
  --review-bg: #24206b;
  --review-text: #b9b2ff;
  --zone-decide-bg: #5c2214;
  --zone-decide-fg: #ffc4b0;
  --zone-decide-line: #ff8a66;
  --zone-mine-bg: #2a2670;
  --zone-mine-fg: #c9c3ff;
  --zone-mine-line: #8e82ff;
  --zone-kids-bg: #0f4a33;
  --zone-kids-fg: #a9ebcb;
  --zone-kids-line: #3dd598;
  --zone-games-bg: #5a3a06;
  --zone-games-fg: #ffd58a;
  --zone-games-line: #ffb933;
  --card-border: #262b4d;
  --card-shadow: none;
  --radius-card: 1.35rem;
  --track: #262b4d;
  --check-border: #3d4372;
  --hero-bg: #1d1a5e;
  --hero-border: #3a33a8;
  --hero-shadow: none;
  --hero-text: #fff;
  --hero-muted: #b9b2ff;
  --hero-track: #2e2a86;
  --tabbar-bg: #1a1f3d;
  --tabbar-border: #2c3260;
  --tabbar-shadow: 0 14px 30px rgb(0 0 0 / 0.45);
  --tabbar-icon: #9aa0c7;
  --tabbar-active-bg: #f2b94b;
  --tabbar-active-text: #2b1a00;
  --cal-event: #8f84ff;
  --cal-task: #fbbf24;
  --cal-birthday: #f472b6;
  --cal-training: #2dd4bf;
  --cal-holiday: #f87171;
  --glass-bar: rgb(22 26 51 / 0.78);
  --glass-tint: rgb(123 108 255 / 0.22);
  --glass-edge: rgb(255 255 255 / 0.18);
  --glass-shade: rgb(0 0 0 / 0.45);
  --glass-ring: rgb(255 255 255 / 0.12);
  --auth-a: #1d1a5e;
  --auth-b: #161a33;
  --auth-c: #0b0e1f;
  --auth-blob: rgb(123 108 255 / 0.28);
  --auth-card: rgb(22 26 51 / 0.78);
  color-scheme: dark;
`

// Тема задаётся CSS-переменными. Явный выбор пользователя — атрибут data-theme на <html>,
// без него тема следует за системной (prefers-color-scheme).
export const GlobalStyle = createGlobalStyle`
  :root {
    ${lightColors}
  }

  :root[data-theme='dark'] {
    ${darkColors}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      ${darkColors}
    }
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 500 16px/1.5 'Nunito Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }

  #root { min-height: 100dvh; }

  /* заголовки и числа жирные и округлые, как в игре */
  h1 { margin: 0; font-size: 1.65rem; font-weight: 900; line-height: 1.15; }
  h2 { margin: 0.5rem 0 0; font-size: 1.15rem; font-weight: 900; }
  h3 { font-weight: 800; }
  strong, b { font-weight: 800; }
  p { margin: 0; }
  code { font-family: ui-monospace, monospace; word-break: break-all; }
`
