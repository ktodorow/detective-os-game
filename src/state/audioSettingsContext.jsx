import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'detective-os.audio.v1'
const AudioSettingsContext = createContext(null)

const clampVolume = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 1
  return Math.min(Math.max(numeric, 0), 1)
}

const isValidSavedState = (value) =>
  value &&
  typeof value === 'object' &&
  typeof value.volume === 'number' &&
  typeof value.muted === 'boolean'

const loadInitialState = () => {
  if (typeof window === 'undefined') {
    return { volume: 1, muted: false }
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return { volume: 1, muted: false }
    const parsed = JSON.parse(stored)
    if (!isValidSavedState(parsed)) {
      return { volume: 1, muted: false }
    }
    return {
      volume: clampVolume(parsed.volume),
      muted: parsed.muted
    }
  } catch {
    return { volume: 1, muted: false }
  }
}

export function AudioSettingsProvider({ children }) {
  const [state, setState] = useState(loadInitialState)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const setVolume = (nextVolume) => {
    const target =
      typeof nextVolume === 'function' ? nextVolume(state.volume) : nextVolume
    setState((prev) => ({
      ...prev,
      volume: clampVolume(target)
    }))
  }

  const setMuted = (nextMuted) => {
    setState((prev) => ({
      ...prev,
      muted: Boolean(nextMuted)
    }))
  }

  const toggleMute = () => {
    setState((prev) => ({
      ...prev,
      muted: !prev.muted
    }))
  }

  const stopAllAudio = () => {
    if (typeof document !== 'undefined') {
      const audioElements = document.querySelectorAll('audio')
      audioElements.forEach((audio) => {
        audio.pause()
        audio.currentTime = 0
      })
    }
    setState((prev) => ({
      ...prev,
      muted: true
    }))
  }

  const value = {
    volume: state.volume,
    muted: state.muted,
    setVolume,
    setMuted,
    toggleMute,
    stopAllAudio
  }

  return (
    <AudioSettingsContext.Provider value={value}>
      {children}
    </AudioSettingsContext.Provider>
  )
}

export function useAudioSettings() {
  const context = useContext(AudioSettingsContext)
  if (!context) {
    throw new Error('useAudioSettings must be used within AudioSettingsProvider')
  }
  return context
}
