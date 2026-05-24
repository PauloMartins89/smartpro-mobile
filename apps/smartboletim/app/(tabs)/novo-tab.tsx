// Esta tela nunca é exibida — o botão central do tab bar
// navega diretamente para /boletim/novo via CentralTabButton.
import { Redirect } from 'expo-router'

export default function NovoTab() {
  return <Redirect href="/boletim/novo" />
}
