import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAudioSettings } from '../state/audioSettingsContext'

const CLOSE_ANIMATION_DURATION = 180

export function VolumeControl({ panelRootRef }) {
  const panelRef = useRef(null)
  const buttonRef = useRef(null)
  const closeTimerRef = useRef(null)
  const [portalRoot, setPortalRoot] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const { volume, muted, setVolume, setMuted, toggleMute, stopAllAudio } =
    useAudioSettings()

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

  const volumePercent = Math.round(volume * 100)
  const displayPercent = muted ? 0 : volumePercent

  const panel = isOpen || isClosing ? (
    <section
      className={`volume-panel ${isClosing ? 'is-closing' : ''}`.trim()}
      ref={panelRef}
      aria-label="Volume panel"
    >
      <header className="volume-header">Volume</header>
      <div className="volume-slider-row">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={displayPercent}
          onChange={(event) => {
            const nextPercent = Number(event.target.value)
            const nextVolume = Math.min(Math.max(nextPercent / 100, 0), 1)
            setVolume(nextVolume)
            if (nextPercent === 0) {
              setMuted(true)
              return
            }
            if (muted) {
              setMuted(false)
            }
          }}
          aria-label="Volume level"
        />
        <span>{displayPercent}%</span>
      </div>
      <div className="volume-actions">
        <button type="button" onClick={toggleMute}>
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          className="is-danger"
          onClick={() => {
            stopAllAudio()
            setVolume(0)
          }}
        >
          Stop
        </button>
      </div>
      <div className="volume-note">Saved for the next launch.</div>
    </section>
  ) : null

  return (
    <>
      <button
        type="button"
        className="taskbar-status-icon volume-toggle"
        title="Volume"
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
          <path d="M11 5L6 9H2v6h4l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 4.9a10 10 0 0 1 0 14.2" />
          {muted ? <line x1="18" y1="6" x2="22" y2="10" /> : null}
          {muted ? <line x1="22" y1="6" x2="18" y2="10" /> : null}
        </svg>
      </button>
      {panel ? (portalRoot ? createPortal(panel, portalRoot) : panel) : null}
    </>
  )
}
