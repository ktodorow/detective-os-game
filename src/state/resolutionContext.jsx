import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ResolutionContext = createContext(null)

export const RESOLUTION_MODES = {
  DEFAULT: 'default',
  FULLSCREEN: 'fullscreen'
}

const DEFAULT_DIMENSIONS = {
  width: '1200px',
  height: '800px'
}

const FULLSCREEN_DIMENSIONS = {
  width: '100vw',
  height: '100vh'
}

export function ResolutionProvider({ children }) {
  const [mode, setMode] = useState(RESOLUTION_MODES.DEFAULT)

  useEffect(() => {
    const root = document.documentElement
    const next =
      mode === RESOLUTION_MODES.FULLSCREEN
        ? FULLSCREEN_DIMENSIONS
        : DEFAULT_DIMENSIONS
    root.style.setProperty('--app-width', next.width)
    root.style.setProperty('--app-height', next.height)
    root.style.setProperty(
      '--app-shadow',
      mode === RESOLUTION_MODES.FULLSCREEN
        ? 'none'
        : '0 24px 80px rgba(0, 0, 0, 0.5)'
    )
  }, [mode])

  const value = useMemo(() => ({ mode, setMode }), [mode])

  return (
    <ResolutionContext.Provider value={value}>
      {children}
    </ResolutionContext.Provider>
  )
}

export function useResolution() {
  const context = useContext(ResolutionContext)
  if (!context) {
    throw new Error('useResolution must be used within ResolutionProvider')
  }
  return context
}
