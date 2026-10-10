import { createGlobalStyle } from 'styled-components'

// цвета заданы переменными, чтобы тёмная тема переключалась одним media-запросом
export const GlobalStyle = createGlobalStyle`
  :root {
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
    color-scheme: light dark;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14131f;
      --surface: #1e1d2e;
      --text: #ececf6;
      --muted: #9998b0;
      --border: #35344b;
      --accent: #7c75f0;
      --error: #ff8a80;
      --on-error: #2a0a08;
      --warning-bg: #3d3416;
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
