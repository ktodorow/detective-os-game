export const NOTIFICATION_EVENT = 'detective-os:notification'

const randomPart = () => Math.floor(Math.random() * 100000)

export const pushNotification = (notification) => {
  if (typeof window === 'undefined') return false
  if (!notification || typeof notification !== 'object') return false

  const title =
    typeof notification.title === 'string' && notification.title.trim()
      ? notification.title.trim()
      : 'Notification'
  const body =
    typeof notification.body === 'string' ? notification.body : ''
  const time =
    typeof notification.time === 'string' && notification.time.trim()
      ? notification.time.trim()
      : 'Now'
  const isRead = notification.isRead === true
  const id =
    typeof notification.id === 'string' && notification.id
      ? notification.id
      : `notification-${Date.now()}-${randomPart()}`

  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_EVENT, {
      detail: { id, title, body, time, isRead }
    })
  )
  return true
}
