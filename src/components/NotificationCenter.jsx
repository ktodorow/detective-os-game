import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SAMPLE_DELAY = 9000
const CLOSE_ANIMATION_DURATION = 180

export function NotificationCenter({ panelRootRef }) {
  const panelRef = useRef(null)
  const buttonRef = useRef(null)
  const closeTimerRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
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
      body: 'Right-click the desktop for settings.',
      time: '2m',
      isRead: true
    }
  ])

  const unreadCount = notifications.filter((item) => !item.isRead).length

  const requestClose = () => {
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
  }

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
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        requestClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
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
    </>
  )
}
