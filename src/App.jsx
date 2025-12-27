import { useEffect, useRef, useState } from 'react'
import './App.css'

const bootLines = [
  'Detective-OS BIOS v0.1.7',
  'Copyright (C) 1994-2025 Noir Systems',
  'CPU: Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
  'Memory Test: 32768MB OK',
  'Checking CMOS checksum . . . OK',
  'Initializing USB Controllers . . . Done',
  'Detecting PCI Devices . . . Done',
  'VGA BIOS . . . OK',
  'Detecting IDE Drives . . .',
  'Primary Master: ST1000LM035-1RK172',
  'Primary Slave: None',
  'Secondary Master: None',
  'Secondary Slave: None',
  'Enabling SMART Monitoring . . . OK',
  'Boot Device: Evidence Vault (EV1)',
  'Loading boot sector . . . OK',
  'Loading boot loader . . . OK',
  'Unpacking kernel image . . . OK',
  'Loading Detective-OS . . . OK',
  'Initializing forensic subsystems . . .',
  'Checking evidence volumes . . . OK',
  'Mounting /mnt/evidence . . . OK',
  'Mounting /mnt/locker . . . OK',
  'Starting device manager . . . OK',
  'Starting input services . . . OK',
  'Starting audio services . . . OK',
  'Starting noir-shell . . . OK',
  'Launching welcome screen . . .'
]

const memoryTestIndex = bootLines.findIndex((line) =>
  line.startsWith('Memory Test:')
)
const bootDeviceIndex = bootLines.findIndex((line) =>
  line.startsWith('Boot Device:')
)

function App() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [flashVisible, setFlashVisible] = useState(false)
  const [bootStarted, setBootStarted] = useState(false)
  const [showBlackout, setShowBlackout] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [hideWelcome, setHideWelcome] = useState(false)
  const [password, setPassword] = useState('')
  const [loginStatus, setLoginStatus] = useState('idle')
  const [fadeToDesktop, setFadeToDesktop] = useState(false)
  const [showDesktop, setShowDesktop] = useState(false)
  const [isComputerOpen, setIsComputerOpen] = useState(false)
  const [isComputerMinimized, setIsComputerMinimized] = useState(false)
  const [isComputerMaximized, setIsComputerMaximized] = useState(false)
  const bodyRef = useRef(null)
  const audioRef = useRef(null)
  const welcomeAudioRef = useRef(null)
  const loginTimersRef = useRef({ auth: null, swap: null })

  useEffect(() => {
    const blackDelay = 1000
    const flashDuration = 600
    const flashTimeout = setTimeout(() => {
      setFlashVisible(true)
    }, blackDelay)
    const bootTimeout = setTimeout(() => {
      setFlashVisible(false)
      setBootStarted(true)
    }, blackDelay + flashDuration)

    return () => {
      clearTimeout(flashTimeout)
      clearTimeout(bootTimeout)
    }
  }, [])

  useEffect(() => {
    if (!bootStarted) return
    if (visibleCount >= bootLines.length) {
      setIsComplete(true)
      return
    }

    let nextDelay = 70 + Math.random() * 140
    if (visibleCount === memoryTestIndex + 1) {
      nextDelay = 2000
    }
    if (visibleCount === bootDeviceIndex + 1) {
      nextDelay = 1000
    }
    const timeout = setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, bootLines.length))
    }, nextDelay)

    return () => clearTimeout(timeout)
  }, [bootStarted, visibleCount])

  useEffect(() => {
    if (!bodyRef.current) return
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [visibleCount])

  useEffect(() => {
    if (!isComplete) return
    const blackoutDelay = 2000
    const welcomeDelay = 700
    const blackoutTimeout = setTimeout(() => {
      setShowBlackout(true)
    }, blackoutDelay)
    const welcomeTimeout = setTimeout(() => {
      setShowWelcome(true)
    }, blackoutDelay + welcomeDelay)

    return () => {
      clearTimeout(blackoutTimeout)
      clearTimeout(welcomeTimeout)
    }
  }, [isComplete])

  useEffect(() => {
    if (!bootStarted) return
    const audio = audioRef.current
    if (!audio) return

    const baseVolume = 0.7
    const fadeDuration = 1.8

    audio.volume = baseVolume
    audio.currentTime = 0

    const handleTimeUpdate = () => {
      if (!audio.duration || Number.isNaN(audio.duration)) return
      const remaining = audio.duration - audio.currentTime
      if (remaining <= fadeDuration) {
        const ratio = Math.max(remaining / fadeDuration, 0)
        audio.volume = ratio * baseVolume
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.play().catch(() => {})

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.pause()
      audio.currentTime = 0
    }
  }, [bootStarted])

  useEffect(() => {
    if (!showWelcome) return
    const audio = welcomeAudioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.volume = 0.8
    audio.play().catch(() => {})
  }, [showWelcome])

  useEffect(() => {
    if (!showLogin) return
    const timeout = setTimeout(() => {
      setHideWelcome(true)
    }, 650)

    return () => clearTimeout(timeout)
  }, [showLogin])

  useEffect(() => {
    return () => {
      if (loginTimersRef.current.auth) {
        clearTimeout(loginTimersRef.current.auth)
      }
      if (loginTimersRef.current.swap) {
        clearTimeout(loginTimersRef.current.swap)
      }
    }
  }, [])

  const handleWelcomeClick = () => {
    if (showLogin) return
    setShowLogin(true)
  }

  const startLogin = () => {
    if (!showLogin || loginStatus === 'authenticating') return
    if (password !== '123') {
      setPassword('')
      return
    }

    setLoginStatus('authenticating')
    const authTimeout = setTimeout(() => {
      setFadeToDesktop(true)
      const swapTimeout = setTimeout(() => {
        setShowDesktop(true)
        setShowWelcome(false)
      }, 700)
      loginTimersRef.current.swap = swapTimeout
    }, 2000)
    loginTimersRef.current.auth = authTimeout
  }

  const handlePasswordKeyDown = (event) => {
    if (event.key === 'Enter') {
      startLogin()
    }
  }

  const openComputerWindow = () => {
    setIsComputerOpen(true)
    setIsComputerMinimized(false)
  }

  const closeComputerWindow = () => {
    setIsComputerOpen(false)
    setIsComputerMinimized(false)
    setIsComputerMaximized(false)
  }

  const toggleComputerMinimize = () => {
    setIsComputerMinimized((prev) => !prev)
  }

  const toggleComputerMaximize = () => {
    setIsComputerMaximized((prev) => !prev)
    setIsComputerMinimized(false)
  }

  if (showDesktop) {
    return (
      <main className="app">
        <div className="viewport desktop-screen">
          <div className="desktop-icons">
            <button className="desktop-icon" type="button" onClick={openComputerWindow}>
              <span className="icon-graphic computer" aria-hidden="true">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <rect x="8" y="10" width="48" height="32" rx="3" />
                  <rect x="14" y="16" width="36" height="20" rx="2" />
                  <rect x="26" y="44" width="12" height="4" rx="1" />
                  <rect x="20" y="48" width="24" height="4" rx="1" />
                </svg>
              </span>
              <span className="icon-label">My Computer</span>
            </button>
            <button className="desktop-icon" type="button">
              <span className="icon-graphic folder" aria-hidden="true">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M8 20a4 4 0 0 1 4-4h14l6 6h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z" />
                  <path d="M8 24h48v8H8z" />
                </svg>
              </span>
              <span className="icon-label">Case Files</span>
            </button>
          </div>
          {isComputerOpen && !isComputerMinimized ? (
            <div
              className={`desktop-window ${
                isComputerMaximized ? 'is-maximized' : ''
              }`}
            >
              <div className="window-titlebar">
                <div className="window-title">My Computer</div>
                <div className="window-controls">
                  <button
                    type="button"
                    onClick={toggleComputerMinimize}
                    aria-label="Minimize window"
                  >
                    _
                  </button>
                  <button
                    type="button"
                    onClick={toggleComputerMaximize}
                    aria-label={
                      isComputerMaximized ? 'Restore window' : 'Maximize window'
                    }
                  >
                    []
                  </button>
                  <button
                    type="button"
                    onClick={closeComputerWindow}
                    aria-label="Close window"
                  >
                    X
                  </button>
                </div>
              </div>
              <div className="window-body">
                <div className="window-empty">No content yet.</div>
              </div>
            </div>
          ) : null}
          <div className="taskbar">
            <button className="start-button" type="button" aria-label="Start">
              <img src="/detective-face.svg" alt="" aria-hidden="true" />
            </button>
            <div className="taskbar-windows">
              {isComputerOpen ? (
                <button
                  className={`taskbar-window ${
                    isComputerMinimized ? 'is-minimized' : 'is-active'
                  }`}
                  type="button"
                  onClick={toggleComputerMinimize}
                >
                  <span className="taskbar-window-icon">PC</span>
                  <span className="taskbar-window-label">Computer</span>
                </button>
              ) : null}
            </div>
            <div className="taskbar-icons" aria-hidden="true">
              <div className="taskbar-icon app-blue">SV</div>
              <div className="taskbar-icon app-amber">EV</div>
              <div className="taskbar-icon app-green">NB</div>
              <div className="taskbar-icon app-slate">DM</div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (showWelcome) {
    return (
      <main className="app">
        <div
          className={`viewport welcome-screen ${
            fadeToDesktop ? 'is-fading-out' : ''
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
          <audio
            ref={welcomeAudioRef}
            src="/audio/os-start.wav"
            preload="auto"
          />
        </div>
      </main>
    )
  }

  if (showBlackout) {
    return (
      <main className="app">
        <div className="viewport blackout-screen" />
      </main>
    )
  }

  return (
    <main className="app">
      <div className="viewport bios-screen">
        {flashVisible ? <div className="boot-flash" aria-hidden="true" /> : null}
        {bootStarted ? (
          <section className="terminal">
            <div className="terminal-body" ref={bodyRef}>
              {bootLines.slice(0, visibleCount).map((line, index) => (
                <div className="boot-line" key={`${line}-${index}`}>
                  {line}
                </div>
              ))}
              <div className="boot-line cursor-line">
                {isComplete ? 'Boot sequence complete' : 'Booting'}
                <span className="cursor" aria-hidden="true" />
              </div>
            </div>
          </section>
        ) : null}
        <audio
          ref={audioRef}
          src="/audio/old90sbootupsound.mp3"
          preload="auto"
        />
      </div>
    </main>
  )
}

export default App
