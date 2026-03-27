export const WIFI_STATUS_STORAGE_KEY = 'detective-os.wifi.status.v1'
export const WIFI_STATUS_CHANGED_EVENT = 'detective-os:wifi-status-changed'

const DEFAULT_WIFI_STATUS = {
  enabled: false,
  connectedId: null,
  connectedName: null,
  signal: null,
  updatedAt: 0
}

const normalizeWifiStatus = (value) => {
  if (!value || typeof value !== 'object') return DEFAULT_WIFI_STATUS
  return {
    enabled: value.enabled === true,
    connectedId: typeof value.connectedId === 'string' ? value.connectedId : null,
    connectedName:
      typeof value.connectedName === 'string' ? value.connectedName : null,
    signal: typeof value.signal === 'string' ? value.signal : null,
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0
  }
}

export const loadWifiStatus = () => {
  if (typeof window === 'undefined') return DEFAULT_WIFI_STATUS
  try {
    const stored = window.localStorage.getItem(WIFI_STATUS_STORAGE_KEY)
    if (!stored) return DEFAULT_WIFI_STATUS
    return normalizeWifiStatus(JSON.parse(stored))
  } catch {
    return DEFAULT_WIFI_STATUS
  }
}

export const saveWifiStatus = (status) => {
  if (typeof window === 'undefined') return
  const next = normalizeWifiStatus(status)
  window.localStorage.setItem(WIFI_STATUS_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(
    new CustomEvent(WIFI_STATUS_CHANGED_EVENT, {
      detail: next
    })
  )
}
