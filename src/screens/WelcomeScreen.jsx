import { useEffect, useRef, useState } from 'react'
import '../styles/welcome.css'

const WELCOME_SOUND_SRC = '/audio/os-start.wav'
const WELCOME_HIDE_DELAY = 650
const LOGIN_DELAY = 2000
const FADE_OUT_DELAY = 700

export function WelcomeScreen({ onLoginSuccess, expectedPassword = '123' }) {
  const [showLogin, setShowLogin] = useState(false)
  const [hideWelcome, setHideWelcome] = useState(false)
  const [password, setPassword] = useState('')
  const [loginStatus, setLoginStatus] = useState('idle')
  const [isFadingOut, setIsFadingOut] = useState(false)
  const welcomeAudioRef = useRef(null)
  const timersRef = useRef({ hide: null, auth: null, swap: null })

  useEffect(() => {
    const audio = welcomeAudioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.volume = 0.8
    audio.play().catch(() => {})
  }, [])

  useEffect(() => {
    if (!showLogin) return
    const timeout = setTimeout(() => {
      setHideWelcome(true)
    }, WELCOME_HIDE_DELAY)
    timersRef.current.hide = timeout

    return () => clearTimeout(timeout)
  }, [showLogin])

  useEffect(() => {
    return () => {
      const { hide, auth, swap } = timersRef.current
      if (hide) clearTimeout(hide)
      if (auth) clearTimeout(auth)
      if (swap) clearTimeout(swap)
    }
  }, [])

  const handleWelcomeClick = () => {
    if (showLogin) return
    setShowLogin(true)
  }

  const startLogin = () => {
    if (!showLogin || loginStatus === 'authenticating') return
    if (password !== expectedPassword) {
      setPassword('')
      return
    }

    setLoginStatus('authenticating')
    const authTimeout = setTimeout(() => {
      setIsFadingOut(true)
      const swapTimeout = setTimeout(() => {
        onLoginSuccess?.()
      }, FADE_OUT_DELAY)
      timersRef.current.swap = swapTimeout
    }, LOGIN_DELAY)
    timersRef.current.auth = authTimeout
  }

  const handlePasswordKeyDown = (event) => {
    if (event.key === 'Enter') {
      startLogin()
    }
  }

  return (
    <main className="app">
      <div
        className={`viewport welcome-screen ${
          isFadingOut ? 'is-fading-out' : ''
        }`}
        onMouseDown={handleWelcomeClick}
      >
        {!hideWelcome ? (
          <div className={`welcome-panel ${showLogin ? 'is-vacuumed' : ''}`}>
            <div className="welcome-title">Detective-OS</div>
            <div className="welcome-subtitle">Welcome</div>
          </div>
        ) : null}
        <div className={`login-panel ${showLogin ? 'is-visible' : ''}`}>
          <div className="login-avatar" aria-hidden="true" />
          <div className="login-name">Detective</div>
          <div className="login-field">
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={handlePasswordKeyDown}
              disabled={loginStatus === 'authenticating'}
            />
            <button
              type="button"
              aria-label="Enter password"
              onClick={startLogin}
              disabled={loginStatus === 'authenticating'}
            >
              &gt;
            </button>
          </div>
        </div>
        <div className="login-footer">Detective-OS</div>
        <div
          className={`logging-overlay ${
            loginStatus === 'authenticating' ? 'is-visible' : ''
          }`}
          aria-hidden="true"
        >
          <div className="logging-box">
            Logging in
            <span className="logging-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        </div>
        <audio ref={welcomeAudioRef} src={WELCOME_SOUND_SRC} preload="auto" />
      </div>
    </main>
  )
}
