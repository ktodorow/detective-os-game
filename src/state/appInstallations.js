export const APP_INSTALLS_STORAGE_KEY = 'detective-os.apps.installed.v1'
export const APP_INSTALLS_CHANGED_EVENT = 'detective-os:apps-installed-changed'

const normalizeInstallMap = (value) => {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value).reduce((acc, [key, isInstalled]) => {
    if (typeof key !== 'string') return acc
    if (isInstalled === true) {
      acc[key] = true
    }
    return acc
  }, {})
}

export const loadInstalledApps = () => {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(APP_INSTALLS_STORAGE_KEY)
    if (!stored) return {}
    return normalizeInstallMap(JSON.parse(stored))
  } catch {
    return {}
  }
}

export const getInstalledAppIds = () => Object.keys(loadInstalledApps())

export const isAppInstalled = (appId) => {
  if (!appId) return false
  const installed = loadInstalledApps()
  return installed[appId] === true
}

export const setAppInstalled = (appId, installed = true) => {
  if (typeof window === 'undefined' || !appId) return false
  const current = loadInstalledApps()
  const shouldBeInstalled = installed === true
  const alreadyInstalled = current[appId] === true
  if (shouldBeInstalled === alreadyInstalled) return alreadyInstalled
  const next = { ...current }
  if (shouldBeInstalled) {
    next[appId] = true
  } else {
    delete next[appId]
  }
  window.localStorage.setItem(APP_INSTALLS_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(
    new CustomEvent(APP_INSTALLS_CHANGED_EVENT, {
      detail: { appId, installed: shouldBeInstalled }
    })
  )
  return shouldBeInstalled
}
