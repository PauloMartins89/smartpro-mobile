// plugins/withGoogleMaps.js
// Injeta a Google Maps API Key no AndroidManifest.xml via variável de ambiente.
// A chave nunca é hardcoded no código-fonte.
const { withAndroidManifest } = require('@expo/config-plugins')

module.exports = function withGoogleMaps(config) {
  return withAndroidManifest(config, async (cfg) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.warn('[withGoogleMaps] GOOGLE_MAPS_API_KEY não definida — mapa pode não funcionar.')
      return cfg
    }
    const manifest = cfg.modResults
    const app = manifest.manifest.application[0]

    // Remove entrada antiga se existir
    app['meta-data'] = (app['meta-data'] ?? []).filter(
      m => m.$['android:name'] !== 'com.google.android.geo.API_KEY'
    )

    // Adiciona a chave
    app['meta-data'].push({
      $: {
        'android:name': 'com.google.android.geo.API_KEY',
        'android:value': apiKey,
      },
    })

    return cfg
  })
}
