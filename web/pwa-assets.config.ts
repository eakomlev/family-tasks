import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// цвет фона значка: тот же индиго, что и на icon.svg (дом с галочкой)
const BACKGROUND = '#4f46e5'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Значок для iOS («На экран Домой»): на всю плашку, без полей и прозрачности. Скругление углов iOS делает сам,
    // а белые поля вокруг (по умолчанию у minimal2023Preset) превращают значок в маленькую картинку на белой плитке.
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { fit: 'contain', background: BACKGROUND },
    },
    // Android обрезает значок маской: рисунок остаётся в безопасной зоне, фон сплошной
    maskable: {
      sizes: [512],
      padding: 0.15,
      resizeOptions: { fit: 'contain', background: BACKGROUND },
    },
  },
  images: ['public/icon.svg'],
})
