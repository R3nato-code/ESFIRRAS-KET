import { useEffect, useState } from 'react'
import EntryScreen from './components/EntryScreen'
import MenuScreen from './components/MenuScreen'

type Screen = 'entry' | 'menu'

export default function App() {
  const [screen, setScreen] = useState<Screen>('entry')

  /* Pausa todas as animações decorativas quando a aba está em segundo plano:
     economiza bateria/GPU e mantém a resposta imediata ao voltar. */
  useEffect(() => {
    const root = document.documentElement
    const sync = () => root.classList.toggle('is-hidden', document.hidden)

    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  /* A entrada fica montada (escondida) na tela do cardápio: o canvas 3D e as
     texturas já preparadas são reaproveitados, então voltar é instantâneo. */
  return (
    <>
      <EntryScreen hidden={screen === 'menu'} onEnter={() => setScreen('menu')} />
      {screen === 'menu' && <MenuScreen onBack={() => setScreen('entry')} />}
    </>
  )
}
