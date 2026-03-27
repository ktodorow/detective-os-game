import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NOTIFICATION_EVENT } from '../state/notifications'

const SAMPLE_DELAY = 9000
const CLOSE_ANIMATION_DURATION = 180
const TOAST_DURATION = 10000

export function NotificationCenter({ panelRootRef }) {
  const panelRef = useRef(null)
  const buttonRef = useRef(null)
  const closeTimerRef = useRef(null)
  const toastTimerRef = useRef(null)
  const toastCloseTimerRef = useRef(null)
  const knownNotificationIdsRef = useRef(new Set())
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [activeToast, setActiveToast] = useState(null)
  const [isToastClosing, setIsToastClosing] = useState(false)
  const [notifications, setNotifications] = useState(() => [
    {
      id: 'sync-01',
      title: 'Evidence Sync',
      body: 'New case file copied to Desktop.',
      time: 'Just now',
      isRead: false
    },
    {
      id: 'tip-01',
      title: 'System Tip',
      body: 'Right-click the desktop for settings or background change.',
      time: '2m',
      isRead: true
    }
  ])

  const unreadCount = notifications.filter((item) => !item.isRead).length

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
  }, [isClosing, isOpen])

  const clearToastTimers = useCallback(() => {
    if (typeof window === 'undefined') return
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    if (toastCloseTimerRef.current) {
      window.clearTimeout(toastCloseTimerRef.current)
      toastCloseTimerRef.current = null
    }
  }, [])

  const dismissToast = useCallback(
    (immediate = false) => {
      clearToastTimers()
      if (immediate || typeof window === 'undefined') {
        setActiveToast(null)
        setIsToastClosing(false)
        return
      }
      setIsToastClosing(true)
      toastCloseTimerRef.current = window.setTimeout(() => {
        setActiveToast(null)
        setIsToastClosing(false)
        toastCloseTimerRef.current = null
      }, CLOSE_ANIMATION_DURATION)
    },
    [clearToastTimers]
  )

  const showToast = useCallback(
    (nextToast) => {
      if (!nextToast) return
      clearToastTimers()
      setIsToastClosing(false)
      setActiveToast(nextToast)
      if (typeof window === 'undefined') return
      toastTimerRef.current = window.setTimeout(() => {
        dismissToast()
      }, TOAST_DURATION)
    },
    [clearToastTimers, dismissToast]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setNotifications((prev) => [
        {
          id: `case-${Date.now()}`,
          title: 'New Lead',
          body: 'A witness uploaded a new recording.',
          time: 'Now',
          isRead: false
        },
        ...prev
      ])
    }, SAMPLE_DELAY)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleNotification = (event) => {
      const payload = event?.detail
      if (!payload || typeof payload !== 'object') return
      const title =
        typeof payload.title === 'string' && payload.title.trim()
          ? payload.title.trim()
          : 'Notification'
      const body = typeof payload.body === 'string' ? payload.body : ''
      const time =
        typeof payload.time === 'string' && payload.time.trim()
          ? payload.time.trim()
          : 'Now'
      const isRead = payload.isRead === true
      const id =
        typeof payload.id === 'string' && payload.id
          ? payload.id
          : `notification-${Date.now()}`

      setNotifications((prev) => {
        if (prev.some((item) => item.id === id)) return prev
        return [{ id, title, body, time, isRead }, ...prev]
      })
    }

    window.addEventListener(NOTIFICATION_EVENT, handleNotification)
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT, handleNotification)
    }
  }, [])

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
    if (!notifications.length) return
    if (!knownNotificationIdsRef.current.size) {
      notifications.forEach((item) =>
        knownNotificationIdsRef.current.add(item.id)
      )
      return
    }

    const newest = notifications.find(
      (item) => !knownNotificationIdsRef.current.has(item.id)
    )

    notifications.forEach((item) => knownNotificationIdsRef.current.add(item.id))

    if (newest) {
      showToast(newest)
    }
  }, [notifications, showToast])

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
      if (toastCloseTimerRef.current) {
        window.clearTimeout(toastCloseTimerRef.current)
      }
    }
  }, [])

  const panel = isOpen || isClosing ? (
    <section
      className={`notification-panel ${isClosing ? 'is-closing' : ''}`.trim()}
      ref={panelRef}
    >
      <header className="notification-header">
        <div>
          Notifications
          {unreadCount > 0 ? (
            <span className="notification-count">{unreadCount}</span>
          ) : null}
        </div>
        <button
          type="button"
          className="notification-clear"
          onClick={() =>
            setNotifications((prev) =>
              prev.map((item) => ({ ...item, isRead: true }))
            )
          }
        >
          Mark all read
        </button>
      </header>
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">No notifications.</div>
        ) : (
          notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notification-item ${
                item.isRead ? 'is-read' : 'is-unread'
              }`}
              onClick={() =>
                setNotifications((prev) =>
                  prev.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, isRead: true }
                      : entry
                  )
                )
              }
            >
              <div className="notification-title">{item.title}</div>
              <div className="notification-body">{item.body}</div>
              <div className="notification-time">{item.time}</div>
            </button>
          ))
        )}
      </div>
    </section>
  ) : null

  const toast = activeToast ? (
    <section
      className={`notification-toast ${isToastClosing ? 'is-closing' : ''}`.trim()}
      aria-live="polite"
    >
      <button
        type="button"
        className="notification-toast-main"
        onClick={() => {
          dismissToast(true)
          if (isClosing && closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
            setIsClosing(false)
          }
          setIsOpen(true)
        }}
      >
        <div className="notification-toast-title">{activeToast.title}</div>
        <div className="notification-toast-body">{activeToast.body}</div>
        <div className="notification-toast-time">{activeToast.time}</div>
      </button>
      <button
        type="button"
        className="notification-toast-close"
        aria-label="Close notification popup"
        onClick={() => dismissToast(true)}
      >
        ×
      </button>
    </section>
  ) : null

  return (
    <>
      <button
        type="button"
        className="taskbar-status-icon notification-toggle"
        title="Notifications"
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
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="notification-badge">{unreadCount}</span>
        ) : null}
      </button>
      {panel
        ? panelRootRef?.current
          ? createPortal(panel, panelRootRef.current)
          : panel
        : null}
      {toast
        ? panelRootRef?.current
          ? createPortal(toast, panelRootRef.current)
          : toast
        : null}
    </>
  )
}
