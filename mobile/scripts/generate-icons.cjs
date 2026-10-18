// Генерирует значки приложения из рисунка веб-версии (web/public/icon.svg: золотой контур дома с тёплым светом в двери на тёмном фоне).
// Запуск из каталога mobile/:  node scripts/generate-icons.cjs
// Использует `sharp` из соседнего пакета media/ (там он уже установлен), отдельной зависимости в mobile/ нет.
// Результат: assets/images/{icon,android-icon-background,android-icon-foreground,android-icon-monochrome,splash-icon,favicon}.png
const path = require('node:path')
const sharp = require(path.join(__dirname, '..', '..', 'media', 'node_modules', 'sharp'))

const OUT = path.join(__dirname, '..', 'assets', 'images')

// золотой контур дома с тёплым светом в двери на тёмном фоне в координатах исходного SVG (512 × 512); те же фигуры, что в web/public/icon.svg
const DEFS = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c2150"/><stop offset="1" stop-color="#07081c"/></linearGradient><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset="1" stop-color="#d9922e"/></linearGradient><radialGradient id="glow" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="#ffcf70" stop-opacity=".85"/><stop offset="1" stop-color="#ffcf70" stop-opacity="0"/></radialGradient><filter id="sh" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="12"/><feOffset dy="14"/><feComponentTransfer><feFuncA type="linear" slope=".6"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
const BG = `<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>`
const HOUSE = `<g filter="url(#sh)"><path d="M278.7 155.6Q256 136 233.3 155.6L133.7 241.5Q121.6 251.9 137.6 251.9L148.6 251.9Q158.6 251.9 158.6 261.9L158.6 340.6Q158.6 374.6 192.6 374.6L319.4 374.6Q353.4 374.6 353.4 340.6L353.4 261.9Q353.4 251.9 363.4 251.9L374.4 251.9Q390.4 251.9 378.3 241.5Z" fill="#0d1030" stroke="url(#gold)" stroke-width="19" stroke-linejoin="round"/></g><rect x="219" y="278.8" width="73.9" height="95.8" rx="37" fill="#ffd477"/><rect x="219" y="278.8" width="73.9" height="95.8" rx="37" fill="url(#glow)"/>`

// рисунок по центру с масштабом (adaptive-значок Android: важное только в центральных ~60%)
const svg = (inner, { scale = 1, background = '' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">${background}<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${inner}</g></svg>`

const png = (xml, file, size = 1024) =>
  sharp(Buffer.from(xml)).resize(size, size).png().toFile(path.join(OUT, file)).then(() => console.log('готово', file))

async function main() {
  await png(svg(DEFS + BG + HOUSE), 'icon.png')
  // адаптивный значок Android: фон и дом отдельными слоями (важное только в центральных ~60%)
  await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">${DEFS}${BG}</svg>`, 'android-icon-background.png')
  await png(svg(DEFS + HOUSE, { scale: 0.85 }), 'android-icon-foreground.png')
  // одноцветный значок (Android 13+, тематические значки): контур дома с дверью
  const mono =
    '<path d="M278.7 155.6Q256 136 233.3 155.6L133.7 241.5Q121.6 251.9 137.6 251.9L148.6 251.9Q158.6 251.9 158.6 261.9L158.6 340.6Q158.6 374.6 192.6 374.6L319.4 374.6Q353.4 374.6 353.4 340.6L353.4 261.9Q353.4 251.9 363.4 251.9L374.4 251.9Q390.4 251.9 378.3 241.5Z" fill="none" stroke="#ffffff" stroke-width="19" stroke-linejoin="round"/>' +
    '<rect x="219" y="278.8" width="73.9" height="95.8" rx="37" fill="#ffffff"/>'
  await png(svg(mono, { scale: 0.85 }), 'android-icon-monochrome.png')
  await png(svg(DEFS + HOUSE, { scale: 0.95 }), 'splash-icon.png')
  await png(svg(DEFS + BG + HOUSE), 'favicon.png', 48)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
