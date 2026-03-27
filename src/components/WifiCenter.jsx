import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const CLOSE_ANIMATION_DURATION = 180
const WIFI_PASSWORDS_STORAGE_KEY = 'detective-os.wifi.passwords.v1'

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
  const [portalRoot, setPortalRoot] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [wifiEnabled, setWifiEnabled] = useState(true)
  const [connectedId, setConnectedId] = useState('vaultnet')
  const [authTargetId, setAuthTargetId] = useState(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savedPasswords, setSavedPasswords] = useState(initSavedPasswords)

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
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      WIFI_PASSWORDS_STORAGE_KEY,
      JSON.stringify(savedPasswords)
    )
  }, [savedPasswords])

  const connectedNetwork =
    wifiEnabled && connectedId
      ? NETWORKS.find((network) => network.id === connectedId) ?? null
      : null
  const authTarget =
    authTargetId && wifiEnabled
      ? NETWORKS.find((network) => network.id === authTargetId) ?? null
      : null

  const resetAuthForm = () => {
    setAuthTargetId(null)
    setPasswordInput('')
    setPasswordError('')
  }

  const handleConnectRequest = (network) => {
    if (!network || !wifiEnabled) return
    if (connectedId === network.id) {
      setConnectedId(null)
      resetAuthForm()
      return
    }
    const rememberedPassword = savedPasswords[network.id]
    if (rememberedPassword && rememberedPassword === network.password) {
      setConnectedId(network.id)
      resetAuthForm()
      return
    }
    setAuthTargetId(network.id)
    setPasswordInput('')
    setPasswordError('')
  }

  const handleAuthSubmit = (event) => {
    event.preventDefault()
    if (!authTarget) return
    if (passwordInput === authTarget.password) {
      setConnectedId(authTarget.id)
      setSavedPasswords((prev) => ({
        ...prev,
        [authTarget.id]: passwordInput
      }))
      resetAuthForm()
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
              return
            }
            setWifiEnabled(true)
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
          const signalClass = SIGNAL_CLASSES[network.signal] ?? SIGNAL_CLASSES.good
          const signalLabel = SIGNAL_LABELS[network.signal] ?? SIGNAL_LABELS.good
          return (
            <button
              key={network.id}
              type="button"
              className={`wifi-network ${isConnected ? 'is-connected' : ''}`.trim()}
              disabled={!wifiEnabled}
              onClick={() => handleConnectRequest(network)}
            >
              <span className="wifi-network-main">
                <span className="wifi-network-name">{network.name}</span>
                <span className="wifi-network-meta">
                  {network.security} - {signalLabel}
                </span>
              </span>
              <span className="wifi-network-side">
                <span className={`wifi-signal ${signalClass}`.trim()} aria-hidden="true" />
                <span className="wifi-action">
                  {isConnected ? 'Disconnect' : 'Connect'}
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
