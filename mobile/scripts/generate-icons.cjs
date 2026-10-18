// Генерирует значки приложения из рисунка веб-версии (web/public/icon.svg: белый дом с галочкой на индиго).
// Запуск из каталога mobile/:  node scripts/generate-icons.cjs
// Использует `sharp` из соседнего пакета media/ (там он уже установлен), отдельной зависимости в mobile/ нет.
// Результат: assets/images/{icon,android-icon-background,android-icon-foreground,android-icon-monochrome,splash-icon,favicon}.png
const path = require('node:path')
const sharp = require(path.join(__dirname, '..', '..', 'media', 'node_modules', 'sharp'))

const OUT = path.join(__dirname, '..', 'assets', 'images')
const INDIGO = '#4f46e5'

// дом и галочка в координатах исходного SVG (512 × 512)
const HOUSE = `<path d="M256 120 L106 246 H162 V382 H350 V246 H406 Z" fill="#ffffff" stroke="#ffffff" stroke-width="44" stroke-linejoin="round"/>`
const CHECK = (color) =>
  `<path d="M196 308 L240 352 L322 262" fill="none" stroke="${color}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`

// рисунок по центру с масштабом (adaptive-значок Android: важное только в центральных ~60%)
const svg = (inner, { scale = 1, background = '' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">${background}<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${inner}</g></svg>`

const png = (xml, file, size = 1024) =>
  sharp(Buffer.from(xml)).resize(size, size).png().toFile(path.join(OUT, file)).then(() => console.log('готово', file))

async function main() {
  const background = `<rect width="512" height="512" fill="${INDIGO}"/>`
  await png(svg(HOUSE + CHECK(INDIGO), { background }), 'icon.png')
  await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">${background}</svg>`, 'android-icon-background.png')
  await png(svg(HOUSE + CHECK(INDIGO), { scale: 0.85 }), 'android-icon-foreground.png')
  // одноцветный значок (Android 13+, тематические значки): белый дом с прорезью-галочкой
  const mono =
    `<defs><mask id="m"><rect width="512" height="512" fill="black"/>${HOUSE}${CHECK('black')}</mask></defs>` +
    `<rect width="512" height="512" fill="#ffffff" mask="url(#m)"/>`
  await png(svg(mono, { scale: 0.85 }), 'android-icon-monochrome.png')
  await png(svg(HOUSE + CHECK(INDIGO), { scale: 0.95 }), 'splash-icon.png')
  await png(svg(HOUSE + CHECK(INDIGO), { background }), 'favicon.png', 48)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
