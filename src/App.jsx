import { useEffect, useReducer } from 'react'
import './styles/base.css'
import { BlackoutScreen } from './screens/BlackoutScreen'
import { BootScreen } from './screens/BootScreen'
import { DesktopScreen } from './screens/DesktopScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { FLOW_EVENTS, FLOW_STATES, flowReducer } from './state/flowMachine'
import { FilesystemProvider } from './state/filesystemContext'
import { ResolutionProvider } from './state/resolutionContext'

const BLACKOUT_DELAY = 2000
const hasWindow = typeof window !== 'undefined'
const devSkipBoot =
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEV_SKIP_BOOT === 'true' ||
    (hasWindow &&
      new URLSearchParams(window.location.search).has('devDesktop')))

function App() {
  const [screen, dispatch] = useReducer(
    flowReducer,
    devSkipBoot ? FLOW_STATES.DESKTOP : FLOW_STATES.BOOT
  )

  useEffect(() => {
    if (screen !== FLOW_STATES.POST_BOOT) return
    const blackoutTimer = setTimeout(() => {
      dispatch({ type: FLOW_EVENTS.SHOW_BLACKOUT })
    }, BLACKOUT_DELAY)

    return () => clearTimeout(blackoutTimer)
  }, [screen])

  const handleBootComplete = () => {
    dispatch({ type: FLOW_EVENTS.BOOT_COMPLETE })
  }

  let content = <BootScreen onComplete={handleBootComplete} />

  if (screen === FLOW_STATES.BLACKOUT) {
    content = (
      <BlackoutScreen
        onComplete={() => dispatch({ type: FLOW_EVENTS.SHOW_WELCOME })}
      />
    )
  }

  if (screen === FLOW_STATES.WELCOME) {
    content = (
      <WelcomeScreen
        onLoginSuccess={() => dispatch({ type: FLOW_EVENTS.LOGIN_SUCCESS })}
      />
    )
  }

  if (screen === FLOW_STATES.DESKTOP) {
    content = <DesktopScreen />
  }

  return (
    <ResolutionProvider>
      <FilesystemProvider>{content}</FilesystemProvider>
    </ResolutionProvider>
  )
}

export default App
