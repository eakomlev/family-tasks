import { createGlobalStyle, css } from 'styled-components'

const lightColors = css`
  --bg: #f7f7fb;
  --surface: #fff;
  --text: #1c1b29;
  --muted: #6b6a80;
  --border: #dcdbe8;
  --accent: #4f46e5;
  --accent-text: #fff;
  --error: #c62828;
  --on-error: #fff;
  --warning-bg: #fff4d6;
  /* «жидкое стекло» панели табов */
  --glass-bar: rgb(255 255 255 / 0.72);
  --glass-tint: rgb(79 70 229 / 0.13);
  --glass-edge: rgb(255 255 255 / 0.9);
  --glass-shade: rgb(79 70 229 / 0.18);
  --glass-ring: rgb(79 70 229 / 0.22);
  color-scheme: light;
`

const darkColors = css`
  --bg: #14131f;
  --surface: #1e1d2e;
  --text: #ececf6;
  --muted: #9998b0;
  --border: #35344b;
  --accent: #7c75f0;
  --accent-text: #fff;
  --error: #ff8a80;
  --on-error: #2a0a08;
  --warning-bg: #3d3416;
  --glass-bar: rgb(30 29 46 / 0.72);
  --glass-tint: rgb(124 117 240 / 0.24);
  --glass-edge: rgb(255 255 255 / 0.28);
  --glass-shade: rgb(0 0 0 / 0.45);
  --glass-ring: rgb(255 255 255 / 0.14);
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
    font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }

  #root { min-height: 100dvh; }

  h1 { margin: 0; font-size: 1.6rem; line-height: 1.2; }
  h2 { margin: 0.5rem 0 0; font-size: 1.1rem; }
  p { margin: 0; }
  code { font-family: ui-monospace, monospace; word-break: break-all; }
`
