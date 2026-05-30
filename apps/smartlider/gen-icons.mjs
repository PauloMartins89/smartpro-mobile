import sharp from 'sharp'

const src      = 'C:/controle financeiros/public/tela de login/img logo icone app.jpeg'
const out      = 'C:/smartpro-mobile/apps/smartlider/assets'

const meta = await sharp(src).metadata()
console.log(`Fonte: ${meta.width}x${meta.height} ${meta.format}`)

// 1. icon.png — 1024x1024 (iOS + geral)
await sharp(src).resize(1024, 1024).png().toFile(`${out}/icon.png`)
console.log('✓ icon.png')

// 2. splash-icon.png
await sharp(src).resize(1024, 1024).png().toFile(`${out}/splash-icon.png`)
console.log('✓ splash-icon.png')

// 3. android-icon-foreground.png — logo 82% do canvas, centrado em fundo transparente
const logoSize = Math.round(1024 * 0.82)
const offset   = Math.round((1024 - logoSize) / 2)
const fgBuf    = await sharp(src).resize(logoSize, logoSize).png().toBuffer()
await sharp({ create: { width: 1024, height: 1024, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fgBuf, top: offset, left: offset }])
  .png().toFile(`${out}/android-icon-foreground.png`)
console.log('✓ android-icon-foreground.png')

// 4. android-icon-background.png — navy sólido (#08122D)
await sharp({ create: { width: 1024, height: 1024, channels: 3,
              background: { r: 8, g: 18, b: 45 } } })
  .png().toFile(`${out}/android-icon-background.png`)
console.log('✓ android-icon-background.png')

// 5. android-icon-monochrome.png — grayscale normalizado
await sharp(src).resize(1024, 1024).grayscale().normalise().png()
  .toFile(`${out}/android-icon-monochrome.png`)
console.log('✓ android-icon-monochrome.png')

// 6. favicon.png — 48x48
await sharp(src).resize(48, 48).png().toFile(`${out}/favicon.png`)
console.log('✓ favicon.png')

console.log('\nPronto! Todos os ícones em assets/')
