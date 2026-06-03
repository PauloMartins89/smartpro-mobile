import { useState } from 'react'
import SplashAnimated from '../src/components/splash/SplashAnimated'

/** Rota de prévia — acessível em http://localhost:8081/splash-preview
 *  Reinicia a animação automaticamente para visualização contínua.
 */
export default function SplashPreview() {
  const [key, setKey] = useState(0)
  return <SplashAnimated key={key} onFinish={() => setKey(k => k + 1)} />
}
