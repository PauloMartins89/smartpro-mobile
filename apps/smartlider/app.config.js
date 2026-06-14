// app.config.js — configuração dinâmica do Expo
// A chave do Google Maps é injetada via variável de ambiente (nunca commitada).
// Para build local: crie .env com GOOGLE_MAPS_API_KEY=sua_chave
// Para EAS build:   eas secret:create --name GOOGLE_MAPS_API_KEY --value sua_chave

import appJson from './app.json'

const mapsKey = process.env.GOOGLE_MAPS_API_KEY ?? ''

// Localiza e substitui o plugin react-native-maps injetando a chave
const plugins = (appJson.expo.plugins ?? []).map(plugin => {
  if (Array.isArray(plugin) && plugin[0] === 'react-native-maps') {
    return ['react-native-maps', { googleMapsApiKey: mapsKey }]
  }
  return plugin
})

export default {
  ...appJson.expo,
  plugins,
}
