import { useEffect, useReducer } from 'react'
import './styles/base.css'
import { BlackoutScreen } from './screens/BlackoutScreen'
import { BootScreen } from './screens/BootScreen'
import { DesktopScreen } from './screens/DesktopScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { FLOW_EVENTS, FLOW_STATES, flowReducer } from './state/flowMachine'

const BLACKOUT_DELAY = 2000

function App() {
  const [screen, dispatch] = useReducer(flowReducer, FLOW_STATES.BOOT)

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

  if (screen === FLOW_STATES.DESKTOP) {
    return <DesktopScreen />
  }

  if (screen === FLOW_STATES.WELCOME) {
    return (
      <WelcomeScreen
        onLoginSuccess={() => dispatch({ type: FLOW_EVENTS.LOGIN_SUCCESS })}
      />
    )
  }

  if (screen === FLOW_STATES.BLACKOUT) {
    return (
      <BlackoutScreen
        onComplete={() => dispatch({ type: FLOW_EVENTS.SHOW_WELCOME })}
      />
    )
  }

  return <BootScreen onComplete={handleBootComplete} />
}

export default App
