import { useEffect, useState } from 'react'
import '../styles/loading.css'

const DEFAULT_DURATION = 2000
const FADE_OUT_DURATION = 600

export function LoadingScreen({ duration = DEFAULT_DURATION, onComplete }) {
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    if (!onComplete) return
    const fadeDelay = Math.max(duration - FADE_OUT_DURATION, 0)
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true)
    }, fadeDelay)
    const doneTimer = setTimeout(() => {
      onComplete()
    }, duration)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [duration, onComplete])

  return (
    <main className="app">
      <div
        className={`viewport loading-screen ${
          isFadingOut ? 'is-fading-out' : ''
        }`}
      >
        <div className="loading-center">
          <div className="loading-spinner" aria-hidden="true" />
          <div className="loading-text">Loading...</div>
        </div>
      </div>
    </main>
  )
}
