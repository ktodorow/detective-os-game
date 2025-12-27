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
  const bodyRef = useRef(null)
  const audioRef = useRef(null)
  const welcomeAudioRef = useRef(null)

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

  const handleWelcomeClick = () => {
    if (showLogin) return
    setShowLogin(true)
  }

  if (showWelcome) {
    return (
      <main className="app">
        <div className="viewport welcome-screen" onMouseDown={handleWelcomeClick}>
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
              />
              <button type="button" aria-label="Enter password">
                &gt;
              </button>
            </div>
          </div>
          <div className="login-header">Login screen</div>
          <div className="login-footer">Detective-OS</div>
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
