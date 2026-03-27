import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { saveWifiStatus } from '../state/wifiStatus'

const CLOSE_ANIMATION_DURATION = 180
const WIFI_PASSWORDS_STORAGE_KEY = 'detective-os.wifi.passwords.v1'
const IN_GAME_TIME_SCALE = 10 / 2
const WIFI_FLUCTUATION_MIN_GAME_SECONDS = 2 * 60 * 60
const WIFI_FLUCTUATION_MAX_GAME_SECONDS = 3 * 60 * 60
const WIFI_RECOVERY_MIN_GAME_SECONDS = 2 * 60
const WIFI_RECOVERY_MAX_GAME_SECONDS = 3 * 60
const WIFI_SIGNAL_CHANGE_CHANCE = 0.45
const WIFI_OUTAGE_TOGGLE_CHANCE = 0.16
const WIFI_RECOVERY_EXTRA_CHANCE = 0.22
const WIFI_CONNECT_FAILURE_CHANCE = 0.2

const NETWORKS = [
  {
    id: 'vaultnet',
    name: 'VaultNet_5G',
    security: 'Secured',
    signal: 'excellent',
    password: 'vault123'
  },
  {
    id: 'precinct',
    name: 'Precinct-Guest',
    security: 'Secured',
    signal: 'good',
    password: 'guest123'
  },
  {
    id: 'forensics',
    name: 'Forensics-Lab',
    security: 'Secured',
    signal: 'fair',
    password: 'lab123'
  },
  {
    id: 'cafe',
    name: 'NightCafe_Free',
    security: 'Secured',
    signal: 'weak',
    password: 'cafe123'
  }
]

const SIGNAL_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  weak: 'Weak'
}

const SIGNAL_CLASSES = {
  excellent: 'is-excellent',
  good: 'is-good',
  fair: 'is-fair',
  weak: 'is-weak'
}

const SIGNAL_ORDER = ['weak', 'fair', 'good', 'excellent']

const getInitialNetworkSignals = () =>
  NETWORKS.reduce((acc, network) => {
    acc[network.id] = network.signal
    return acc
  }, {})

const getInitialNetworkAvailability = () =>
  NETWORKS.reduce((acc, network) => {
    acc[network.id] = true
    return acc
  }, {})

const clampSignalIndex = (index) =>
  Math.min(Math.max(index, 0), SIGNAL_ORDER.length - 1)

const getRandomRealFluctuationDelayMs = () => {
  const range =
    WIFI_FLUCTUATION_MAX_GAME_SECONDS - WIFI_FLUCTUATION_MIN_GAME_SECONDS
  const randomGameSeconds =
    WIFI_FLUCTUATION_MIN_GAME_SECONDS + Math.random() * Math.max(range, 0)
  return Math.max(1200, Math.round((randomGameSeconds * 1000) / IN_GAME_TIME_SCALE))
}

const getRandomRealRecoveryDelayMs = () => {
  const range = WIFI_RECOVERY_MAX_GAME_SECONDS - WIFI_RECOVERY_MIN_GAME_SECONDS
  const randomGameSeconds =
    WIFI_RECOVERY_MIN_GAME_SECONDS + Math.random() * Math.max(range, 0)
  return Math.max(800, Math.round((randomGameSeconds * 1000) / IN_GAME_TIME_SCALE))
}

const getNextRandomSignal = (currentSignal) => {
  const currentIndex = Math.max(SIGNAL_ORDER.indexOf(currentSignal), 0)
  const stepMagnitude = Math.random() < 0.78 ? 1 : 2
  const direction = Math.random() < 0.5 ? -1 : 1
  const nextIndex = clampSignalIndex(currentIndex + direction * stepMagnitude)
  if (nextIndex !== currentIndex) {
    return SIGNAL_ORDER[nextIndex]
  }
  const fallbackDirection = currentIndex <= 1 ? 1 : -1
  return SIGNAL_ORDER[clampSignalIndex(currentIndex + fallbackDirection)]
}

const initSavedPasswords = () => {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(WIFI_PASSWORDS_STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

export function WifiCenter({ panelRootRef }) {
  const panelRef = useRef(null)
  const buttonRef = useRef(null)
  const closeTimerRef = useRef(null)
  const recoveryTimersRef = useRef({})
  const [portalRoot, setPortalRoot] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [wifiEnabled, setWifiEnabled] = useState(true)
  const [connectedId, setConnectedId] = useState('vaultnet')
  const [networkSignals, setNetworkSignals] = useState(getInitialNetworkSignals)
  const [networkAvailability, setNetworkAvailability] = useState(
    getInitialNetworkAvailability
  )
  const [authTargetId, setAuthTargetId] = useState(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [savedPasswords, setSavedPasswords] = useState(initSavedPasswords)

  const resetAuthForm = useCallback(() => {
    setAuthTargetId(null)
    setPasswordInput('')
    setPasswordError('')
  }, [])

  useEffect(() => {
    setPortalRoot(panelRootRef?.current ?? null)
  }, [panelRootRef])

  const requestClose = useCallback(() => {
    if (!isOpen || isClosing) return
    if (typeof window === 'undefined') {
      setIsOpen(false)
      setIsClosing(false)
      return
    }
    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false)
      setIsClosing(false)
      closeTimerRef.current = null
    }, CLOSE_ANIMATION_DURATION)
  }, [isOpen, isClosing])

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event) => {
      const panel = panelRef.current
      const button = buttonRef.current
      if (panel?.contains(event.target) || button?.contains(event.target)) {
        return
      }
      requestClose()
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen, requestClose])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        requestClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requestClose])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(closeTimerRef.current)
      }
      if (typeof window !== 'undefined') {
        Object.values(recoveryTimersRef.current).forEach((timerId) => {
          window.clearTimeout(timerId)
        })
      }
      recoveryTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      WIFI_PASSWORDS_STORAGE_KEY,
      JSON.stringify(savedPasswords)
    )
  }, [savedPasswords])

  const connectedNetwork = useMemo(() => {
    if (!wifiEnabled || !connectedId) return null
    return NETWORKS.find((network) => network.id === connectedId) ?? null
  }, [connectedId, wifiEnabled])
  const connectedSignal = connectedNetwork
    ? networkSignals[connectedNetwork.id] ?? connectedNetwork.signal
    : null
  const authTarget =
    authTargetId &&
    wifiEnabled &&
    networkAvailability[authTargetId] !== false
      ? NETWORKS.find((network) => network.id === authTargetId) ?? null
      : null

  useEffect(() => {
    saveWifiStatus({
      enabled: wifiEnabled,
      connectedId: connectedNetwork?.id ?? null,
      connectedName: connectedNetwork?.name ?? null,
      signal: connectedSignal,
      updatedAt: Date.now()
    })
  }, [connectedNetwork, connectedSignal, wifiEnabled])

  useEffect(() => {
    if (typeof window === 'undefined' || !wifiEnabled) return undefined
    let timerId = null

    const scheduleNextChange = () => {
      timerId = window.setTimeout(() => {
        setNetworkSignals((prev) => {
          const next = { ...prev }
          let changed = false
          NETWORKS.forEach((network) => {
            if (Math.random() > WIFI_SIGNAL_CHANGE_CHANCE) return
            const currentSignal = next[network.id] ?? network.signal
            const candidateSignal = getNextRandomSignal(currentSignal)
            if (candidateSignal === currentSignal) return
            next[network.id] = candidateSignal
            changed = true
          })
          return changed ? next : prev
        })

        setNetworkAvailability((prev) => {
          const next = { ...prev }
          let changed = false
          NETWORKS.forEach((network) => {
            const currentAvailable = prev[network.id] !== false
            let nextAvailable = currentAvailable
            if (Math.random() < WIFI_OUTAGE_TOGGLE_CHANCE) {
              nextAvailable = !currentAvailable
            } else if (!currentAvailable && Math.random() < WIFI_RECOVERY_EXTRA_CHANCE) {
              nextAvailable = true
            }
            if (nextAvailable !== currentAvailable) {
              next[network.id] = nextAvailable
              changed = true
            }
          })

          const hasAvailable = NETWORKS.some((network) => next[network.id] !== false)
          if (!hasAvailable && NETWORKS.length > 0) {
            const randomNetwork =
              NETWORKS[Math.floor(Math.random() * NETWORKS.length)]
            next[randomNetwork.id] = true
            changed = true
          }

          return changed ? next : prev
        })
        scheduleNextChange()
      }, getRandomRealFluctuationDelayMs())
    }

    scheduleNextChange()
    return () => {
      if (timerId) {
        window.clearTimeout(timerId)
      }
    }
  }, [wifiEnabled])

  useEffect(() => {
    if (typeof window === 'undefined') return

    NETWORKS.forEach((network) => {
      const isUnavailable = networkAvailability[network.id] === false
      const hasRecoveryTimer = Boolean(recoveryTimersRef.current[network.id])

      if (isUnavailable && !hasRecoveryTimer) {
        recoveryTimersRef.current[network.id] = window.setTimeout(() => {
          setNetworkAvailability((prev) => {
            if (prev[network.id] !== false) return prev
            return { ...prev, [network.id]: true }
          })
          if (recoveryTimersRef.current[network.id]) {
            window.clearTimeout(recoveryTimersRef.current[network.id])
            delete recoveryTimersRef.current[network.id]
          }
        }, getRandomRealRecoveryDelayMs())
      }

      if (!isUnavailable && hasRecoveryTimer) {
        window.clearTimeout(recoveryTimersRef.current[network.id])
        delete recoveryTimersRef.current[network.id]
      }
    })
  }, [networkAvailability])

  useEffect(() => {
    if (!statusMessage || typeof window === 'undefined') return undefined
    const timerId = window.setTimeout(() => {
      setStatusMessage('')
    }, 4200)
    return () => window.clearTimeout(timerId)
  }, [statusMessage])

  useEffect(() => {
    if (!wifiEnabled || !connectedId) return
    if (networkAvailability[connectedId] !== false) return
    setConnectedId(null)
    resetAuthForm()
    setStatusMessage('Connection lost: network became unavailable.')
  }, [connectedId, networkAvailability, resetAuthForm, wifiEnabled])

  useEffect(() => {
    if (!authTargetId) return
    if (networkAvailability[authTargetId] !== false) return
    resetAuthForm()
    setStatusMessage('Selected network is temporarily unavailable.')
  }, [authTargetId, networkAvailability, resetAuthForm])

  const handleConnectRequest = (network) => {
    if (!network || !wifiEnabled) return
    if (connectedId === network.id) {
      setConnectedId(null)
      resetAuthForm()
      setStatusMessage('')
      return
    }
    const isAvailable = networkAvailability[network.id] !== false
    if (!isAvailable) {
      setStatusMessage(`${network.name} is temporarily unavailable.`)
      return
    }
    const rememberedPassword = savedPasswords[network.id]
    if (rememberedPassword && rememberedPassword === network.password) {
      if (Math.random() < WIFI_CONNECT_FAILURE_CHANCE) {
        setStatusMessage(`Could not connect to ${network.name}. Try again.`)
        return
      }
      setConnectedId(network.id)
      resetAuthForm()
      setStatusMessage('')
      return
    }
    setAuthTargetId(network.id)
    setPasswordInput('')
    setPasswordError('')
    setStatusMessage('')
  }

  const handleAuthSubmit = (event) => {
    event.preventDefault()
    if (!authTarget) return
    const isAvailable = networkAvailability[authTarget.id] !== false
    if (!isAvailable) {
      setPasswordError('Network unavailable right now. Try again soon.')
      return
    }
    if (passwordInput === authTarget.password) {
      if (Math.random() < WIFI_CONNECT_FAILURE_CHANCE) {
        setPasswordError('Connection failed due to unstable signal. Try again.')
        return
      }
      setConnectedId(authTarget.id)
      setSavedPasswords((prev) => ({
        ...prev,
        [authTarget.id]: passwordInput
      }))
      resetAuthForm()
      setStatusMessage('')
      return
    }
    setPasswordError('Wrong password. Try the hint below.')
  }

  const panel = isOpen || isClosing ? (
    <section
      className={`wifi-panel ${isClosing ? 'is-closing' : ''}`.trim()}
      ref={panelRef}
      aria-label="Wi-Fi panel"
    >
      <header className="wifi-header">
        <div>Wi-Fi</div>
        <button
          type="button"
          className={`wifi-power ${wifiEnabled ? 'is-on' : 'is-off'}`.trim()}
          onClick={() => {
            if (wifiEnabled) {
              setWifiEnabled(false)
              setConnectedId(null)
              resetAuthForm()
              setStatusMessage('')
              return
            }
            setWifiEnabled(true)
            setStatusMessage('')
          }}
        >
          {wifiEnabled ? 'On' : 'Off'}
        </button>
      </header>
      <div className="wifi-summary">
        {wifiEnabled
          ? connectedNetwork
            ? `Connected to ${connectedNetwork.name}`
            : 'Not connected'
          : 'Wi-Fi is turned off'}
        {statusMessage ? (
          <div className="wifi-summary-warning">{statusMessage}</div>
        ) : null}
      </div>
      {authTarget ? (
        <form className="wifi-auth-card" onSubmit={handleAuthSubmit}>
          <div className="wifi-auth-title">Connect to {authTarget.name}</div>
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => {
              setPasswordInput(event.target.value)
              if (passwordError) {
                setPasswordError('')
              }
            }}
            placeholder="Enter password"
            autoFocus
          />
          {passwordError ? <div className="wifi-auth-error">{passwordError}</div> : null}
          <div className="wifi-auth-hint">Hint: {authTarget.password}</div>
          <div className="wifi-auth-actions">
            <button type="button" onClick={resetAuthForm}>
              Cancel
            </button>
            <button type="submit" className="is-primary">
              Connect
            </button>
          </div>
        </form>
      ) : null}
      <div className="wifi-list">
        {NETWORKS.map((network) => {
          const isConnected = wifiEnabled && connectedId === network.id
          const signal = networkSignals[network.id] ?? network.signal
          const isAvailable = networkAvailability[network.id] !== false
          const signalClass = SIGNAL_CLASSES[signal] ?? SIGNAL_CLASSES.good
          const signalLabel = SIGNAL_LABELS[signal] ?? SIGNAL_LABELS.good
          return (
            <button
              key={network.id}
              type="button"
              className={`wifi-network ${isConnected ? 'is-connected' : ''} ${
                !isAvailable ? 'is-unavailable' : ''
              }`.trim()}
              disabled={!wifiEnabled || (!isConnected && !isAvailable)}
              onClick={() => handleConnectRequest(network)}
            >
              <span className="wifi-network-main">
                <span className="wifi-network-name">{network.name}</span>
                <span className="wifi-network-meta">
                  {network.security} - {signalLabel}
                  {!isAvailable ? ' - Unavailable' : ''}
                </span>
              </span>
              <span className="wifi-network-side">
                <span className={`wifi-signal ${signalClass}`.trim()} aria-hidden="true" />
                <span className="wifi-action">
                  {isConnected ? 'Disconnect' : isAvailable ? 'Connect' : 'Unavailable'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  ) : null

  return (
    <>
      <button
        type="button"
        className="taskbar-status-icon wifi-toggle"
        title="Wi-Fi"
        ref={buttonRef}
        onClick={() => {
          if (isOpen) {
            requestClose()
            return
          }
          if (isClosing) {
            if (closeTimerRef.current) {
              window.clearTimeout(closeTimerRef.current)
              closeTimerRef.current = null
            }
            setIsClosing(false)
          }
          setIsOpen(true)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M1.4 9a16 16 0 0 1 21.2 0" />
          <path d="M5 12.5a11 11 0 0 1 14.1 0" />
          <path d="M8.6 16.1a6 6 0 0 1 6.8 0" />
          <path d="M12 20h.01" />
        </svg>
      </button>
      {panel ? (portalRoot ? createPortal(panel, portalRoot) : panel) : null}
    </>
  )
}
