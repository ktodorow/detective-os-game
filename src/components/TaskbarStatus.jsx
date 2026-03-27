import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NotificationCenter } from './NotificationCenter'
import { pushNotification } from '../state/notifications'
import { VolumeControl } from './VolumeControl'
import { WifiCenter } from './WifiCenter'

const CLOSE_ANIMATION_DURATION = 180
const REMINDERS_STORAGE_KEY = 'detective-os.reminders.v1'
const REMINDER_WARNING_WINDOW_MS = 3 * 60 * 60 * 1000
const REMINDER_AUTO_DONE_GRACE_MS = 3 * 60 * 1000
const REMINDER_CHECK_INTERVAL_MS = 30 * 1000
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit'
})
const TIME_WITH_SECONDS_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: '2-digit',
  year: 'numeric'
})
const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric'
})
const DEADLINE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const isSameDate = (leftDate, rightDate) =>
  leftDate.getFullYear() === rightDate.getFullYear() &&
  leftDate.getMonth() === rightDate.getMonth() &&
  leftDate.getDate() === rightDate.getDate()

const buildCalendarCells = (sourceDate) => {
  const year = sourceDate.getFullYear()
  const month = sourceDate.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPreviousMonth = new Date(year, month, 0).getDate()
  const totalSlots = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const today = new Date()
  const cells = []

  for (let slot = 0; slot < totalSlots; slot += 1) {
    const dayNumber = slot - firstWeekday + 1
    let cellDate
    let isCurrentMonth = true

    if (dayNumber < 1) {
      cellDate = new Date(year, month - 1, daysInPreviousMonth + dayNumber)
      isCurrentMonth = false
    } else if (dayNumber > daysInMonth) {
      cellDate = new Date(year, month + 1, dayNumber - daysInMonth)
      isCurrentMonth = false
    } else {
      cellDate = new Date(year, month, dayNumber)
    }

    cells.push({
      key: `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`,
      day: cellDate.getDate(),
      isCurrentMonth,
      isToday: isSameDate(cellDate, today)
    })
  }

  return cells
}

const toMonthStart = (sourceDate) =>
  new Date(sourceDate.getFullYear(), sourceDate.getMonth(), 1)

const shiftMonth = (sourceDate, delta) =>
  new Date(sourceDate.getFullYear(), sourceDate.getMonth() + delta, 1)

const monitorReminderDeadlines = () => {
  if (typeof window === 'undefined') return
  let reminders
  try {
    const stored = window.localStorage.getItem(REMINDERS_STORAGE_KEY)
    if (!stored) return
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return
    reminders = parsed
  } catch {
    return
  }
  if (!reminders.length) return

  const now = Date.now()
  let changed = false
  const nextReminders = reminders.map((reminder, index) => {
    if (!reminder || typeof reminder !== 'object') return reminder
    const reminderDueAt =
      typeof reminder.dueAt === 'string' && reminder.dueAt
        ? reminder.dueAt
        : null
    if (!reminderDueAt) return reminder

    const dueTimestamp = Date.parse(reminderDueAt)
    if (Number.isNaN(dueTimestamp)) return reminder

    const reminderId =
      typeof reminder.id === 'string' && reminder.id
        ? reminder.id
        : `reminder-${index}`
    let nextReminder = reminder
    const isDone = reminder.done === true
    const warningSent = Boolean(reminder.warningSentAt)
    const timeUntilDue = dueTimestamp - now

    if (
      !warningSent &&
      !isDone &&
      timeUntilDue > 0 &&
      timeUntilDue <= REMINDER_WARNING_WINDOW_MS
    ) {
      pushNotification({
        id: `reminder-warning-${reminderId}-${dueTimestamp}`,
        title: 'Reminder Deadline Near',
        body: `"${reminder.text ?? 'Reminder'}" is due at ${
          reminder.dueLabel ?? DEADLINE_FORMATTER.format(new Date(dueTimestamp))
        }.`,
        time: 'Now'
      })
      nextReminder = {
        ...nextReminder,
        warningSentAt: new Date(now).toISOString()
      }
      changed = true
    }

    if (!isDone && now >= dueTimestamp + REMINDER_AUTO_DONE_GRACE_MS) {
      nextReminder = {
        ...nextReminder,
        done: true,
        autoCompletedAt: new Date(now).toISOString()
      }
      changed = true
    }

    return nextReminder
  })

  if (changed) {
    window.localStorage.setItem(
      REMINDERS_STORAGE_KEY,
      JSON.stringify(nextReminders)
    )
  }
}

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
