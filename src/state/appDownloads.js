export const APP_DOWNLOADS_STORAGE_KEY = 'detective-os.apps.downloads.v1'
export const APP_DOWNLOADS_CHANGED_EVENT = 'detective-os:apps-downloads-changed'

export const DOWNLOAD_TICK_MS = 200
export const DEFAULT_APP_DOWNLOAD_SIZE_MB = 100
export const MAX_CONCURRENT_DOWNLOADS = 3

const DOWNLOAD_MBPS_BY_SIGNAL = {
  excellent: 14,
  good: 9,
  fair: 5,
  weak: 2
}

const normalizeDownloadMap = (value) => {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value).reduce((acc, [appId, progress]) => {
    if (typeof appId !== 'string' || !appId) return acc
    if (typeof progress !== 'number' || Number.isNaN(progress)) return acc
    if (progress < 0 || progress >= 100) return acc
    acc[appId] = progress
    return acc
  }, {})
}

export const loadAppDownloads = () => {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(APP_DOWNLOADS_STORAGE_KEY)
    if (!stored) return {}
    return normalizeDownloadMap(JSON.parse(stored))
  } catch {
    return {}
  }
}

export const setAppDownloads = (nextDownloads) => {
  if (typeof window === 'undefined') return {}
  const normalized = normalizeDownloadMap(nextDownloads)
  const nextSnapshot = JSON.stringify(normalized)
  const currentSnapshot =
    window.localStorage.getItem(APP_DOWNLOADS_STORAGE_KEY) ?? '{}'
  if (nextSnapshot !== currentSnapshot) {
    window.localStorage.setItem(APP_DOWNLOADS_STORAGE_KEY, nextSnapshot)
    window.dispatchEvent(
      new CustomEvent(APP_DOWNLOADS_CHANGED_EVENT, {
        detail: { downloads: normalized }
      })
    )
  }
  return normalized
}

export const updateAppDownloads = (updater) => {
  const current = loadAppDownloads()
  const next = typeof updater === 'function' ? updater(current) : current
  return setAppDownloads(next)
}

export const startAppDownload = (appId) => {
  if (typeof window === 'undefined' || !appId) return false
  let started = false
  updateAppDownloads((prev) => {
    if (typeof prev[appId] === 'number') return prev
    if (Object.keys(prev).length >= MAX_CONCURRENT_DOWNLOADS) return prev
    started = true
    return { ...prev, [appId]: 0 }
  })
  return started
}

export const cancelAppDownload = (appId) => {
  if (typeof window === 'undefined' || !appId) return false
  let removed = false
  updateAppDownloads((prev) => {
    if (!(appId in prev)) return prev
    const next = { ...prev }
    delete next[appId]
    removed = true
    return next
  })
  return removed
}

export const getWifiDownloadMbps = (wifiStatus) => {
  if (!wifiStatus?.enabled || !wifiStatus?.connectedId) return 0
  return DOWNLOAD_MBPS_BY_SIGNAL[wifiStatus.signal] ?? 3
}
