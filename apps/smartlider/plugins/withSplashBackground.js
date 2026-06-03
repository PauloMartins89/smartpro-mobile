const { withAndroidStyles, withAndroidColors, withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Config plugin que corrige a tela branca com círculos no startup do Android.
 *
 * CAUSA RAIZ (diagnosticado em 03/06/2026):
 * 1. colors.xml tinha splashscreen_background = #FFFFFF (branco) usado pelo adaptive icon
 * 2. values/styles.xml: windowSplashScreenBackground só no AppTheme, mas MainActivity usa
 *    Theme.App.SplashScreen que sobrescreve windowBackground sem definir windowSplashScreenBackground
 * 3. values-v31/styles.xml NÃO EXISTIA — Android 12+ ignora values/styles.xml e usa
 *    colorBackground da DayNight theme (branco)
 * 4. ic_launcher.xml tinha <monochrome> — Android 13+ Themed Icons mostra ícone monocromático
 *    (os círculos cinzas) sobre o fundo branco
 *
 * SOLUÇÃO:
 * - Corrige colors.xml: splashscreen_background → cor escura
 * - Corrige values/styles.xml: AppTheme + Theme.App.SplashScreen
 * - CRIA values-v31/styles.xml: override explícito para Android 12+
 * - Remove <monochrome> do ic_launcher.xml: elimina os círculos cinzas
 */
module.exports = function withSplashBackground(config, { color = '#000000' } = {}) {
  // ── 1. colors.xml ────────────────────────────────────────────────────────
  config = withAndroidColors(config, (cfg) => {
    if (!cfg.modResults.resources.color) cfg.modResults.resources.color = []
    const colors = cfg.modResults.resources.color

    const upsert = (name, val) => {
      const idx = colors.findIndex((c) => c.$.name === name)
      if (idx >= 0) colors[idx]._ = val
      else colors.push({ $: { name }, _: val })
    }

    // Fundo do adaptive icon e do splash pré-Android 12
    upsert('splashscreen_background', color)
    // Fundo do ícone adaptativo (usado no mipmap/ic_launcher_background em algumas versões)
    upsert('iconBackground', color)

    return cfg
  })

  // ── 2. values/styles.xml ─────────────────────────────────────────────────
  config = withAndroidStyles(config, (cfg) => {
    if (!cfg.modResults.resources.style) cfg.modResults.resources.style = []
    const styles = cfg.modResults.resources.style

    const addItem = (style, name, val) => {
      if (!style.item) style.item = []
      const idx = style.item.findIndex((i) => i.$.name === name)
      if (idx >= 0) style.item[idx]._ = val
      else style.item.push({ $: { name }, _: val })
    }

    // AppTheme: fallback geral
    const appTheme = styles.find((s) => s.$.name === 'AppTheme')
    if (appTheme) {
      addItem(appTheme, 'android:windowBackground', color)
      addItem(appTheme, 'android:windowSplashScreenBackground', color)
    }

    // Theme.App.SplashScreen: tema direto da MainActivity
    const splashTheme = styles.find((s) => s.$.name === 'Theme.App.SplashScreen')
    if (splashTheme) {
      addItem(splashTheme, 'android:windowBackground', color)
      addItem(splashTheme, 'android:windowSplashScreenBackground', color)
      addItem(splashTheme, 'android:windowSplashScreenIconBackgroundColor', color)
    }

    return cfg
  })

  // ── 3. values-v31/styles.xml (Android 12+ — override definitivo) ─────────
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const resDir = path.join(
        cfg.modRequest.projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
      )
      const v31Dir = path.join(resDir, 'values-v31')
      fs.mkdirSync(v31Dir, { recursive: true })

      // Override explícito para API 31+ — maior prioridade que values/styles.xml
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Android 12+ (API 31+): override explícito para eliminar tela branca -->
    <style name="Theme.App.SplashScreen" parent="AppTheme">
        <item name="android:windowBackground">${color}</item>
        <item name="android:windowSplashScreenBackground">${color}</item>
        <item name="android:windowSplashScreenIconBackgroundColor">${color}</item>
    </style>
</resources>`

      fs.writeFileSync(path.join(v31Dir, 'styles.xml'), xml, 'utf8')
      return cfg
    },
  ])

  // ── 4. Remove <monochrome> do ic_launcher.xml (elimina círculos no Android 13+) ──
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const icLauncherPath = path.join(
        cfg.modRequest.projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'mipmap-anydpi-v26',
        'ic_launcher.xml',
      )
      if (fs.existsSync(icLauncherPath)) {
        let xml = fs.readFileSync(icLauncherPath, 'utf8')
        // Remove elemento <monochrome .../>  (self-closing, pode ter / no atributo)
        xml = xml.replace(/[ \t]*<monochrome\b[^>]*\/?>\s*/g, '')
        xml = xml.replace(/<monochrome\b[^>]*>[\s\S]*?<\/monochrome>\s*/g, '')
        fs.writeFileSync(icLauncherPath, xml, 'utf8')
      }

      // Remove também do ic_launcher_round.xml se existir
      const icLauncherRoundPath = icLauncherPath.replace('ic_launcher.xml', 'ic_launcher_round.xml')
      if (fs.existsSync(icLauncherRoundPath)) {
        let xml = fs.readFileSync(icLauncherRoundPath, 'utf8')
        xml = xml.replace(/\s*<monochrome[^/]*(\/\s*>|>[^<]*<\/monochrome>)/g, '')
        fs.writeFileSync(icLauncherRoundPath, xml, 'utf8')
      }

      return cfg
    },
  ])

  return config
}
