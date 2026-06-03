const { withAndroidStyles } = require('@expo/config-plugins')

/**
 * Config plugin que define a cor de fundo do splash screen nativo do Android 12+
 * (windowSplashScreenBackground) sem depender do expo-splash-screen plugin,
 * que causa erros de Gradle neste projeto.
 */
module.exports = function withSplashBackground(config, { color = '#000000' } = {}) {
  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults

    // Garante que a estrutura existe
    if (!styles.resources) styles.resources = {}
    if (!styles.resources.style) styles.resources.style = []

    // Procura o AppTheme
    let appTheme = styles.resources.style.find((s) => s.$.name === 'AppTheme')

    if (!appTheme) {
      // Cria o AppTheme se não existir
      appTheme = {
        $: { name: 'AppTheme', parent: 'Theme.AppCompat.Light.NoActionBar' },
        item: [],
      }
      styles.resources.style.push(appTheme)
    }

    if (!appTheme.item) appTheme.item = []

    // Remove entradas anteriores para evitar duplicatas
    appTheme.item = appTheme.item.filter(
      (i) =>
        i.$.name !== 'android:windowSplashScreenBackground' &&
        i.$.name !== 'android:windowBackground'
    )

    // Define a cor de fundo para Android 12+ (API 31+)
    appTheme.item.push({
      $: { name: 'android:windowSplashScreenBackground' },
      _: color,
    })

    // Define windowBackground também (fallback para Android < 12)
    appTheme.item.push({
      $: { name: 'android:windowBackground' },
      _: color,
    })

    return cfg
  })
}
