// generate-icons.mjs
// Gera todos os assets de ícone do SmartLíder a partir da imagem fonte.
// Execute: node generate-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.join(__dirname, 'assets')
const SOURCE = 'C:\\controle financeiros\\public\\tela de login\\img logo icone app.jpeg'

if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true })

async function resize(size, outFile, options = {}) {
  let pipeline = sharp(SOURCE).resize(size, size, { fit: 'cover' })
  if (options.background) {
    // solid background only (no source image)
    pipeline = sharp({ create: { width: size, height: size, channels: 4, background: options.background } })
  }
  await pipeline.png().toFile(path.join(assetsDir, outFile))
  console.log(`✓ ${outFile} (${size}x${size})`)
}

async function makeMonochrome(size, outFile) {
  // Extract luminance → threshold → white mask on transparent background
  const { data, info } = await sharp(SOURCE)
    .resize(size, size, { fit: 'cover' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const rgba = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const lum = data[i]
    const alpha = lum > 30 ? 255 : 0   // dark navy bg becomes transparent
    rgba[i * 4 + 0] = 255  // R white
    rgba[i * 4 + 1] = 255  // G white
    rgba[i * 4 + 2] = 255  // B white
    rgba[i * 4 + 3] = alpha
  }
  await sharp(rgba, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile(path.join(assetsDir, outFile))
  console.log(`✓ ${outFile} (${size}x${size})`)
}

async function main() {
  console.log('Gerando ícones SmartLíder...\n')
  await resize(1024, 'icon.png')
  await resize(512,  'splash-icon.png')
  await resize(1024, 'android-icon-foreground.png')
  await resize(1024, 'android-icon-background.png', { background: { r: 11, g: 22, b: 48, alpha: 1 } })
  await makeMonochrome(1024, 'android-icon-monochrome.png')
  await resize(48,   'favicon.png')
  console.log('\nConcluído! Arquivos em:', assetsDir)
}

main().catch(e => { console.error(e); process.exit(1) })

// (old SVG factory removed — using source image directly)
/*
function makeSvg_UNUSED(size, { bg = true, monochrome = false } = {}) {
  const cx = size / 2, cy = size / 2
  const outerR = Math.round(size * 0.371)   // 380 @ 1024
  const innerR = Math.round(size * 0.315)   // 323 @ 1024
  const toRad  = a => a * Math.PI / 180

  // Gap at the bottom: 60°→120° (SVG coords: 0°=right, clockwise, 90°=bottom)
  const gapStart = 60, gapEnd = 120

  const p = (r, a) => [
    (cx + r * Math.cos(toRad(a))).toFixed(1),
    (cy + r * Math.sin(toRad(a))).toFixed(1),
  ]

  const [ox1, oy1] = p(outerR, gapEnd)    // outer arc start (120°, bottom-left)
  const [ox2, oy2] = p(outerR, gapStart)  // outer arc end   (60°,  bottom-right)
  const [ix2, iy2] = p(innerR, gapStart)  // inner arc start (60°)
  const [ix1, iy1] = p(innerR, gapEnd)    // inner arc end   (120°)

  // Ring: outer clockwise (large arc) → inner counterclockwise (large arc)
  const ringPath =
    `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 1 1 ${ox2} ${oy2}` +
    ` L ${ix2} ${iy2} A ${innerR} ${innerR} 0 1 0 ${ix1} ${iy1} Z`

  // Bars (3 bars: short / medium / tall, left→right)
  const bw  = Math.round(size * 0.059)   // bar width  ~60
  const gap = Math.round(size * 0.019)   // bar gap    ~19
  const bx0 = Math.round(cx - (3 * bw + 2 * gap) / 2)  // left edge
  const bot = Math.round(cy + size * 0.125)              // bottom y ~640
  const br  = Math.round(size * 0.013)   // border-radius ~13
  const h   = [Math.round(size * 0.108), Math.round(size * 0.172), Math.round(size * 0.234)]
  // [110, 176, 239] @ 1024

  const bars = [0, 1, 2].map(i => {
    const x = bx0 + i * (bw + gap)
    return `<rect x="${x}" y="${bot - h[i]}" width="${bw}" height="${h[i]}" rx="${br}" fill="${monochrome ? 'white' : 'url(#bGrad)'}"/>`
  }).join('\n    ')

  // Colors
  const navyBg  = '#0B1630'
  const glowBlur = Math.max(4, Math.round(size * 0.006))

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${bg && !monochrome ? `
    <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0D1C33"/>
      <stop offset="100%" stop-color="#060E1A"/>
    </linearGradient>` : ''}

    <!-- Ring gradient: bottom (cyan) → top (yellow-green) -->
    <linearGradient id="rGrad" x1="50%" y1="100%" x2="50%" y2="0%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="${monochrome ? 'white' : '#00B4FF'}"/>
      <stop offset="40%"  stop-color="${monochrome ? 'white' : '#00FF80'}"/>
      <stop offset="75%"  stop-color="${monochrome ? 'white' : '#AAFF00'}"/>
      <stop offset="100%" stop-color="${monochrome ? 'white' : '#CCFF00'}"/>
    </linearGradient>

    <!-- Bar gradient: bottom (cyan-blue) → top (green-yellow) -->
    <linearGradient id="bGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%"   stop-color="#00B4FF"/>
      <stop offset="100%" stop-color="#88FF00"/>
    </linearGradient>

    <!-- Glow filter -->
    <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${glowBlur}" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  ${bg && !monochrome ? `<rect width="${size}" height="${size}" fill="url(#bgG)"/>` : ''}

  <!-- Logo group with glow -->
  <g filter="url(#glow)">
    <!-- Ring arc -->
    <path d="${ringPath}" fill="${monochrome ? 'white' : 'url(#rGrad)'}"/>

    <!-- Bar chart -->
    ${bars}
  </g>
</svg>`
}

// ─── Generate all assets ─────────────────────────────────────────────────────
async function run() {
  const jobs = [
    // Main icon (iOS + general) — 1024×1024 with background
    { file: 'icon.png',                    size: 1024, opts: { bg: true  } },

    // Splash icon — same as icon
    { file: 'splash-icon.png',             size: 1024, opts: { bg: true  } },

    // Android adaptive foreground — transparent bg, logo fills ~80% safe zone
    { file: 'android-icon-foreground.png', size: 1024, opts: { bg: false } },

    // Android adaptive background — solid navy tile
    { file: 'android-icon-background.png', size: 1024, opts: { bg: true,  solidBg: '#0B1630' } },

    // Android monochrome — white logo on transparent
    { file: 'android-icon-monochrome.png', size: 1024, opts: { bg: false, monochrome: true } },

    // Favicon
    { file: 'favicon.png',                 size: 1024, opts: { bg: true  }, resize: 48 },
  ]

  for (const job of jobs) {
    const filePath = path.join(assetsDir, job.file)
    let pipeline

    if (job.opts.solidBg) {
      // Solid color background — generate via sharp directly
      const svg = makeSvg(job.size, { bg: false })
      const bg  = await sharp({
        create: { width: job.size, height: job.size, channels: 3,
                  background: { r: 11, g: 22, b: 48 } }
      }).png().toBuffer()
      const fg  = await sharp(Buffer.from(svg)).png().toBuffer()
      pipeline  = sharp(bg).composite([{ input: fg }])
    } else {
      pipeline = sharp(Buffer.from(makeSvg(job.size, job.opts)))
    }

    if (job.resize) pipeline = pipeline.resize(job.resize, job.resize)
    await pipeline.png().toFile(filePath)
    console.log(`✓ ${job.file}`)
  }

  console.log('\nTodos os ícones gerados em assets/')
}

run().catch(err => { console.error(err); process.exit(1) })
*/
