// Генерирует набор мобильных значков из общего рисунка web/public/icon.png.
// Запуск из каталога mobile/: node scripts/generate-icons.cjs
// Использует sharp из соседнего пакета media/.
const path = require('node:path')
const sharp = require(path.join(__dirname, '..', '..', 'media', 'node_modules', 'sharp'))

const SOURCE = path.join(__dirname, '..', '..', 'web', 'public', 'icon.png')
const OUT = path.join(__dirname, '..', 'assets', 'images')

async function main() {
  const master = await sharp(SOURCE).resize(1024, 1024, { fit: 'cover' }).png().toBuffer()
  const { data, info } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const foreground = Buffer.from(data)
  const mono = Buffer.from(data)

  // Для тематического значка Android сохраняем форму лент как белый силуэт с прозрачным фоном.
  for (let i = 0; i < mono.length; i += info.channels) {
    const [red, green, blue] = [mono[i], mono[i + 1], mono[i + 2]]
    const distance = Math.max(255 - red, 255 - green, 255 - blue)
    const alpha = distance < 10 ? 0 : Math.round((distance - 10) * (255 / 245))
    foreground[i + 3] = alpha
    mono[i] = 255
    mono[i + 1] = 255
    mono[i + 2] = 255
    mono[i + 3] = alpha
  }

  await sharp(master).png().toFile(path.join(OUT, 'icon.png'))
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#ffffff' } })
    .png()
    .toFile(path.join(OUT, 'android-icon-background.png'))
  const center = { top: 102, right: 102, bottom: 102, left: 102, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  await sharp(Buffer.from(foreground), { raw: info })
    .resize(820, 820)
    .extend(center)
    .png()
    .toFile(path.join(OUT, 'android-icon-foreground.png'))
  await sharp(Buffer.from(mono), { raw: info })
    .resize(820, 820)
    .extend(center)
    .png()
    .toFile(path.join(OUT, 'android-icon-monochrome.png'))
  await sharp(master).png().toFile(path.join(OUT, 'splash-icon.png'))
  await sharp(master).resize(48, 48).png().toFile(path.join(OUT, 'favicon.png'))

  console.log('готово: значки созданы из web/public/icon.png')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
