import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NotificationCenter } from './NotificationCenter'
import { WifiCenter } from './WifiCenter'

export function TaskbarStatus({ panelRootRef }) {
  const panelRef = useRef(null)
  const buttonRef = useRef(null)
  const closeTimerRef = useRef(null)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [portalRoot, setPortalRoot] = useState(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isCalendarClosing, setIsCalendarClosing] = useState(false)
  const [viewedMonth, setViewedMonth] = useState(() => toMonthStart(new Date()))

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const timerId = window.setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    monitorReminderDeadlines()
    const timerId = window.setInterval(
      monitorReminderDeadlines,
      REMINDER_CHECK_INTERVAL_MS
    )
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    setPortalRoot(panelRootRef?.current ?? null)
  }, [panelRootRef])

  const requestCloseCalendar = useCallback(() => {
    if (!isCalendarOpen || isCalendarClosing) return
    if (typeof window === 'undefined') {
      setIsCalendarOpen(false)
      setIsCalendarClosing(false)
      return
    }
    setIsCalendarClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setIsCalendarOpen(false)
      setIsCalendarClosing(false)
      closeTimerRef.current = null
    }, CLOSE_ANIMATION_DURATION)
  }, [isCalendarClosing, isCalendarOpen])

  useEffect(() => {
    if (!isCalendarOpen) return
    const handlePointerDown = (event) => {
      const panel = panelRef.current
      const button = buttonRef.current
      if (panel?.contains(event.target) || button?.contains(event.target)) {
        return
      }
      requestCloseCalendar()
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [isCalendarOpen, requestCloseCalendar])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        requestCloseCalendar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requestCloseCalendar])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const timeText = TIME_FORMATTER.format(currentDate)
  const timeWithSecondsText = TIME_WITH_SECONDS_FORMATTER.format(currentDate)
  const dateText = DATE_FORMATTER.format(currentDate)
  const monthYearText = MONTH_YEAR_FORMATTER.format(viewedMonth)
  const calendarCells = useMemo(
    () => buildCalendarCells(viewedMonth),
    [viewedMonth]
  )

  const calendarPanel = isCalendarOpen || isCalendarClosing ? (
    <section
      className={`calendar-panel ${isCalendarClosing ? 'is-closing' : ''}`.trim()}
      ref={panelRef}
      aria-label="Calendar"
    >
      <div className="calendar-header">
        <div className="calendar-title">{timeWithSecondsText}</div>
        <div className="calendar-subtitle">{dateText}</div>
      </div>
      <div className="calendar-controls">
        <div className="calendar-nav-group">
          <button
            type="button"
            className="calendar-nav-button"
            aria-label="Previous year"
            onClick={() => setViewedMonth((prev) => shiftMonth(prev, -12))}
          >
            «
          </button>
          <button
            type="button"
            className="calendar-nav-button"
            aria-label="Previous month"
            onClick={() => setViewedMonth((prev) => shiftMonth(prev, -1))}
          >
            ‹
          </button>
        </div>
        <div className="calendar-month-label">{monthYearText}</div>
        <div className="calendar-nav-group">
          <button
            type="button"
            className="calendar-nav-button"
            aria-label="Next month"
            onClick={() => setViewedMonth((prev) => shiftMonth(prev, 1))}
          >
            ›
          </button>
          <button
            type="button"
            className="calendar-nav-button"
            aria-label="Next year"
            onClick={() => setViewedMonth((prev) => shiftMonth(prev, 12))}
          >
            »
          </button>
        </div>
      </div>
      <button
        type="button"
        className="calendar-today-button"
        onClick={() => setViewedMonth(toMonthStart(currentDate))}
      >
        Jump to current month
      </button>
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="calendar-grid" role="grid">
        {calendarCells.map((cell) => (
          <div
            key={cell.key}
            role="gridcell"
            className={`calendar-day ${cell.isCurrentMonth ? '' : 'is-outside'} ${
              cell.isToday ? 'is-today' : ''
            }`.trim()}
          >
            {cell.day}
          </div>
        ))}
      </div>
    </section>
  ) : null

  return (
    <div className="taskbar-status" aria-label="System status">
      <WifiCenter panelRootRef={panelRootRef} />
      <NotificationCenter panelRootRef={panelRootRef} />
      <VolumeControl panelRootRef={panelRootRef} />
      <button
        type="button"
        className="taskbar-clock taskbar-clock-toggle"
        aria-label={`Current date and time: ${dateText}, ${timeText}`}
        ref={buttonRef}
        onClick={() => {
          if (isCalendarOpen) {
            requestCloseCalendar()
            return
          }
          if (isCalendarClosing) {
            if (closeTimerRef.current) {
              window.clearTimeout(closeTimerRef.current)
              closeTimerRef.current = null
            }
            setIsCalendarClosing(false)
          }
          setViewedMonth(toMonthStart(currentDate))
          setIsCalendarOpen(true)
        }}
      >
        <div className="taskbar-clock-time">{timeText}</div>
        <div className="taskbar-clock-date">{dateText}</div>
      </button>
      {calendarPanel
        ? portalRoot
          ? createPortal(calendarPanel, portalRoot)
          : calendarPanel
        : null}
    </div>
  )
}
