import { useEffect, useRef, useState } from 'react'
import { bootLines } from '../constants/bootLines'
import '../styles/boot.css'

const BOOT_SOUND_SRC = '/audio/old90sbootupsound.mp3'
const BLACK_DELAY = 1000
const FLASH_DURATION = 600
const FADE_DURATION = 1.8
const MEMORY_PAUSE = 2000
const BOOT_DEVICE_PAUSE = 1000

const memoryTestIndex = bootLines.findIndex((line) =>
  line.startsWith('Memory Test:')
)
const bootDeviceIndex = bootLines.findIndex((line) =>
  line.startsWith('Boot Device:')
)

export function BootScreen({ onComplete }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [flashVisible, setFlashVisible] = useState(false)
  const [bootStarted, setBootStarted] = useState(false)
  const bodyRef = useRef(null)
  const audioRef = useRef(null)
  const completedRef = useRef(false)

  useEffect(() => {
    const flashTimeout = setTimeout(() => {
      setFlashVisible(true)
    }, BLACK_DELAY)
    const bootTimeout = setTimeout(() => {
      setFlashVisible(false)
      setBootStarted(true)
    }, BLACK_DELAY + FLASH_DURATION)

    return () => {
      clearTimeout(flashTimeout)
      clearTimeout(bootTimeout)
    }
  }, [])

  useEffect(() => {
    if (!bootStarted) return
    if (visibleCount >= bootLines.length) {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete?.()
      }
      return
    }

    let nextDelay = 70 + Math.random() * 140
    if (visibleCount === memoryTestIndex + 1) {
      nextDelay = MEMORY_PAUSE
    }
    if (visibleCount === bootDeviceIndex + 1) {
      nextDelay = BOOT_DEVICE_PAUSE
    }
    const timeout = setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, bootLines.length))
    }, nextDelay)

    return () => clearTimeout(timeout)
  }, [bootStarted, onComplete, visibleCount])

  useEffect(() => {
    if (!bodyRef.current) return
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [visibleCount])

  useEffect(() => {
    if (!bootStarted) return
    const audio = audioRef.current
    if (!audio) return

    const baseVolume = 1
    audio.volume = baseVolume
    audio.currentTime = 0

    const handleTimeUpdate = () => {
      if (!audio.duration || Number.isNaN(audio.duration)) return
      const remaining = audio.duration - audio.currentTime
      if (remaining <= FADE_DURATION) {
        const ratio = Math.max(remaining / FADE_DURATION, 0)
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
                {visibleCount >= bootLines.length
                  ? 'Boot sequence complete'
                  : 'Booting'}
                <span className="cursor" aria-hidden="true" />
              </div>
            </div>
          </section>
        ) : null}
        <audio ref={audioRef} src={BOOT_SOUND_SRC} preload="auto" />
      </div>
    </main>
  )
}
