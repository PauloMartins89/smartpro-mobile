// app.config.js — configuração dinâmica do Expo
// A chave do Google Maps é injetada via variável de ambiente pelo plugin withGoogleMaps.
// Para build local: crie .env com GOOGLE_MAPS_API_KEY=sua_chave
// Para EAS build:   eas env:create --name GOOGLE_MAPS_API_KEY

import appJson from './app.json'

export default {
  ...appJson.expo,
}
