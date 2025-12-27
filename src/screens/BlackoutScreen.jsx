import { useEffect } from 'react'
import '../styles/boot.css'

export function BlackoutScreen({ duration = 700, onComplete }) {
  useEffect(() => {
    if (!onComplete) return
    const timeout = setTimeout(() => {
      onComplete()
    }, duration)
    return () => clearTimeout(timeout)
  }, [duration, onComplete])

  return (
    <main className="app">
      <div className="viewport blackout-screen" />
    </main>
  )
}
