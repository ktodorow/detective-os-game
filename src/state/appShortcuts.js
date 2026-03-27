export const APP_SHORTCUTS_STORAGE_KEY = 'detective-os.app-shortcuts.v1'
export const APP_SHORTCUTS_CHANGED_EVENT = 'detective-os:app-shortcuts-changed'

const DEFAULT_APP_SHORTCUT_PATH = '/home/Desktop'

const normalizePath = (path) => {
  if (typeof path !== 'string') return null
  const trimmed = path.trim()
  if (!trimmed) return null
  const normalized = `/${trimmed}`.replace(/\/+/g, '/')
  if (normalized !== '/' && normalized.endsWith('/')) {
    return normalized.slice(0, -1)
  }
  return normalized
}

const normalizeShortcutMap = (value) => {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value).reduce((acc, [appId, targetPath]) => {
    if (typeof appId !== 'string' || !appId) return acc
    const normalizedPath = normalizePath(targetPath)
    if (!normalizedPath) return acc
    if (normalizedPath === DEFAULT_APP_SHORTCUT_PATH) return acc
    acc[appId] = normalizedPath
    return acc
  }, {})
}

export const loadAppShortcutPaths = () => {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(APP_SHORTCUTS_STORAGE_KEY)
    if (!stored) return {}
    return normalizeShortcutMap(JSON.parse(stored))
  } catch {
    return {}
  }
}

export const getAppShortcutPath = (appId, sourceMap = null) => {
  if (!appId || typeof appId !== 'string') return DEFAULT_APP_SHORTCUT_PATH
  const shortcutMap =
    sourceMap && typeof sourceMap === 'object' ? sourceMap : loadAppShortcutPaths()
  const storedPath = shortcutMap[appId]
  return normalizePath(storedPath) ?? DEFAULT_APP_SHORTCUT_PATH
}

export const setAppShortcutPath = (appId, targetPath) => {
  if (typeof window === 'undefined') return false
  if (!appId || typeof appId !== 'string') return false

  const normalizedTargetPath = normalizePath(targetPath)
  if (!normalizedTargetPath) return false

  const current = loadAppShortcutPaths()
  const currentPath = getAppShortcutPath(appId, current)
  if (currentPath === normalizedTargetPath) return true

  const next = { ...current }
  if (normalizedTargetPath === DEFAULT_APP_SHORTCUT_PATH) {
    delete next[appId]
  } else {
    next[appId] = normalizedTargetPath
  }

  window.localStorage.setItem(APP_SHORTCUTS_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(
    new CustomEvent(APP_SHORTCUTS_CHANGED_EVENT, {
      detail: {
        appId,
        path: normalizedTargetPath
      }
    })
  )
  return true
}

export const resetAppShortcutPath = (appId) =>
  setAppShortcutPath(appId, DEFAULT_APP_SHORTCUT_PATH)
