import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FileDialog } from '../components/FileDialog'
import { FileExplorer } from '../components/FileExplorer'
import { pushNotification } from '../state/notifications'
import {
  APP_INSTALLS_CHANGED_EVENT,
  getInstalledAppIds,
  isAppInstalled,
  setAppInstalled
} from '../state/appInstallations'
import { resetAppShortcutPath } from '../state/appShortcuts'
import { RESOLUTION_MODES } from '../state/resolutionContext'
import {
  loadWifiStatus,
  WIFI_STATUS_CHANGED_EVENT
} from '../state/wifiStatus'

const EmptyState = () => <div className="window-empty">No content yet.</div>
const EMAIL_APP_ID = 'email'
const REMINDER_APP_ID = 'reminder'
const FRIEND_MEDIA_APP_ID = 'friendmedia'
const BOX_BROWSER_APP_ID = 'boxbrowser'
const REMINDERS_STORAGE_KEY = 'detective-os.reminders.v1'
const REMINDER_BOARD_VISIBLE_STORAGE_KEY = 'detective-os.reminders.board.visible.v1'
const REMINDER_BOARD_VISIBILITY_CHANGED_EVENT =
  'detective-os:reminder-board-visibility-changed'
const REMINDER_SYNC_INTERVAL_MS = 30 * 1000
const DOWNLOAD_TICK_MS = 200
const DEFAULT_APP_DOWNLOAD_SIZE_MB = 100
const MAX_CONCURRENT_DOWNLOADS = 3
const DOWNLOAD_MBPS_BY_SIGNAL = {
  excellent: 14,
  good: 9,
  fair: 5,
  weak: 2
}
const APP_STORE_CATALOG = [
  {
    id: EMAIL_APP_ID,
    title: 'Email',
    description: 'Icon-only app for now.'
  },
  {
    id: REMINDER_APP_ID,
    title: 'Reminder',
    description: 'Create and track your reminders.'
  },
  {
    id: FRIEND_MEDIA_APP_ID,
    title: 'FriendMedia',
    description: 'Social media app shell (non-functional for now).'
  },
  {
    id: BOX_BROWSER_APP_ID,
    title: 'BoxBrowser',
    description: 'Browser app shell (non-functional for now).'
  }
]
const REMINDER_CREATED_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  day: '2-digit'
})
const REMINDER_DUE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const padNumber = (value) => String(value).padStart(2, '0')

const toDateInputValue = (sourceDate) =>
  `${sourceDate.getFullYear()}-${padNumber(sourceDate.getMonth() + 1)}-${padNumber(sourceDate.getDate())}`

const toTimeInputValue = (sourceDate) =>
  `${padNumber(sourceDate.getHours())}:${padNumber(sourceDate.getMinutes())}`

const buildReminderDueDate = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null
  const [yearRaw, monthRaw, dayRaw] = dateValue.split('-')
  const [hourRaw, minuteRaw] = timeValue.split(':')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null
  }

  const dueDate = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (
    Number.isNaN(dueDate.getTime()) ||
    dueDate.getFullYear() !== year ||
    dueDate.getMonth() !== month - 1 ||
    dueDate.getDate() !== day
  ) {
    return null
  }
  return dueDate
}

const formatReminderDueLabel = (dueDate) => REMINDER_DUE_FORMATTER.format(dueDate)

const loadReminderBoardVisible = () => {
  if (typeof window === 'undefined') return true
  try {
    const stored = window.localStorage.getItem(REMINDER_BOARD_VISIBLE_STORAGE_KEY)
    if (!stored) return true
    return JSON.parse(stored) !== false
  } catch {
    return true
  }
}

const saveReminderBoardVisible = (visible) => {
  if (typeof window === 'undefined') return
  const nextVisible = visible === true
  window.localStorage.setItem(
    REMINDER_BOARD_VISIBLE_STORAGE_KEY,
    JSON.stringify(nextVisible)
  )
  window.dispatchEvent(
    new CustomEvent(REMINDER_BOARD_VISIBILITY_CHANGED_EVENT, {
      detail: { visible: nextVisible }
    })
  )
}

const loadReminderItems = () => {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(REMINDERS_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const dueAt =
          typeof item.dueAt === 'string' && item.dueAt ? item.dueAt : null
        let dueLabel =
          typeof item.dueLabel === 'string' && item.dueLabel.trim()
            ? item.dueLabel.trim()
            : null
        if (!dueLabel && dueAt) {
          const parsedDue = new Date(dueAt)
          if (!Number.isNaN(parsedDue.getTime())) {
            dueLabel = formatReminderDueLabel(parsedDue)
          }
        }

        return {
          id:
            typeof item.id === 'string' && item.id
              ? item.id
              : `reminder-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          text:
            typeof item.text === 'string' ? item.text.trim() : '',
          done: item.done === true,
          createdAt:
            typeof item.createdAt === 'string' ? item.createdAt : 'Now',
          dueAt,
          dueLabel,
          warningSentAt:
            typeof item.warningSentAt === 'string' ? item.warningSentAt : null,
          autoCompletedAt:
            typeof item.autoCompletedAt === 'string' ? item.autoCompletedAt : null
        }
      })
      .filter((item) => item.text.length > 0)
  } catch {
    return []
  }
}

const getWifiDownloadMbps = (wifiStatus) => {
  if (!wifiStatus?.enabled || !wifiStatus?.connectedId) return 0
  return DOWNLOAD_MBPS_BY_SIGNAL[wifiStatus.signal] ?? 3
}

const ComputerIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="8" y="10" width="48" height="32" rx="3" />
    <rect x="14" y="16" width="36" height="20" rx="2" />
    <rect x="26" y="44" width="12" height="4" rx="1" />
    <rect x="20" y="48" width="24" height="4" rx="1" />
  </svg>
)

const FolderIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 20a4 4 0 0 1 4-4h14l6 6h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z" />
    <path d="M8 24h48v8H8z" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M18 18h28l-2 36a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" />
    <path d="M14 18h36" />
    <path d="M24 18l2-6h12l2 6" />
    <path d="M28 26v22" />
    <path d="M36 26v22" />
  </svg>
)

const SettingsIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="10" />
    <path d="M32 6l4 8 9 2-6 7 1 9-8-4-8 4 1-9-6-7 9-2z" />
  </svg>
)

const NotepadIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="14" y="10" width="36" height="44" rx="4" />
    <rect x="20" y="18" width="24" height="4" rx="2" />
    <rect x="20" y="28" width="24" height="4" rx="2" />
    <rect x="20" y="38" width="16" height="4" rx="2" />
  </svg>
)

const EmailIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="10" y="16" width="44" height="32" rx="4" />
    <path d="M10 20l22 15 22-15" />
  </svg>
)

const ReminderIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="14" y="10" width="36" height="44" rx="6" />
    <rect x="22" y="20" width="20" height="4" rx="2" />
    <rect x="22" y="30" width="16" height="4" rx="2" />
    <circle cx="24" cy="42" r="3" />
  </svg>
)

const FriendMediaIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="22" cy="24" r="8" />
    <circle cx="42" cy="26" r="7" />
    <path d="M10 50a12 12 0 0 1 24 0" />
    <path d="M32 50a10 10 0 0 1 20 0" />
  </svg>
)

const BoxBrowserIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="10" y="12" width="44" height="40" rx="6" />
    <rect x="10" y="12" width="44" height="10" rx="6" />
    <circle cx="18" cy="17" r="2" />
    <circle cx="25" cy="17" r="2" />
    <circle cx="32" cy="17" r="2" />
    <rect x="18" y="28" width="28" height="16" rx="3" />
  </svg>
)

const AppStoreIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M16 22h32l-3 30a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4z" />
    <path d="M24 22v-4a8 8 0 0 1 16 0v4" />
    <rect x="27" y="34" width="10" height="4" rx="2" />
    <rect x="30" y="31" width="4" height="10" rx="2" />
  </svg>
)

const BackgroundIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="8" y="10" width="48" height="36" rx="4" />
    <circle cx="22" cy="22" r="5" />
    <path d="M14 40l12-12 9 9 7-7 8 10" />
    <rect x="20" y="50" width="24" height="4" rx="2" />
  </svg>
)

const SettingsWindow = ({ resolution, ui }) => {
  return (
    <div className="settings-panel">
      <div className="settings-title">Display</div>
      <div className="settings-group">
        <div className="settings-label">Resolution</div>
        <label className="settings-option">
          <input
            type="radio"
            name="resolution"
            checked={resolution.mode === RESOLUTION_MODES.DEFAULT}
            onChange={() => resolution.setMode(RESOLUTION_MODES.DEFAULT)}
          />
          <span>Default (1200 × 800)</span>
        </label>
        <label className="settings-option">
          <input
            type="radio"
            name="resolution"
            checked={resolution.mode === RESOLUTION_MODES.FULLSCREEN}
            onChange={() => resolution.setMode(RESOLUTION_MODES.FULLSCREEN)}
          />
          <span>Browser (Fill screen)</span>
        </label>
        <div className="settings-note">
          Fill mode uses the current browser size.
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-label">Native Fullscreen</div>
        <div className="settings-row">
          <button
            className="settings-button"
            type="button"
            onClick={() => {
              resolution.setMode(RESOLUTION_MODES.FULLSCREEN)
              resolution.toggleSystemFullscreen()
            }}
            disabled={!resolution.canFullscreen}
          >
            {resolution.isSystemFullscreen
              ? 'Exit Fullscreen'
              : 'Enter Fullscreen'}
          </button>
          <span className="settings-note">
            {resolution.canFullscreen
              ? 'Removes browser UI for true fullscreen.'
              : 'Fullscreen is not available in this browser.'}
          </span>
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-label">Data</div>
        <div className="settings-row">
          <button
            className="settings-button settings-danger"
            type="button"
            onClick={() =>
              ui?.openConfirm?.({
                title: 'Factory Reset',
                message:
                  'This will permanently delete all game data, files, and settings from this device. There is no undo.',
                confirmLabel: 'Yes, delete everything',
                cancelLabel: 'No, cancel',
                tone: 'danger',
                onConfirm: ui?.startFactoryReset
              })
            }
          >
            Factory Reset
          </button>
          <span className="settings-note">
            Deletes all saved files and settings.
          </span>
        </div>
      </div>
    </div>
  )
}

const renderSettings = (_window, { resolution, ui }) => (
  <SettingsWindow resolution={resolution} ui={ui} />
)

const renderComputer = (appWindow, { filesystem, actions, ui }) => {
  const watchedPath =
    appWindow?.payload?.startPath && appWindow?.payload?.startPath !== '/'
      ? appWindow.payload.startPath
      : null

  return (
    <FileExplorer
      filesystem={filesystem}
      openWindow={actions.openWindow}
      ui={ui}
      startPath={appWindow?.payload?.startPath ?? '/'}
      watchPath={watchedPath}
      onWatchPathMissing={() => actions.closeWindow(appWindow.id)}
    />
  )
}

const renderTrash = (_window, { filesystem, actions, ui }) => (
  <FileExplorer
    filesystem={filesystem}
    openWindow={actions.openWindow}
    ui={ui}
    startPath="/home/Trash"
  />
)

const getDirectoryPath = (path) => {
  if (!path) return '/home/Desktop'
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return '/'
  return `/${parts.slice(0, -1).join('/')}`
}

const getBasename = (path) => {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? 'Untitled.txt'
}

const ensureTxtExtension = (name) => {
  const trimmed = name.trim()
  if (!trimmed) return 'Untitled.txt'
  const lower = trimmed.toLowerCase()
  if (lower.endsWith('.txt')) return trimmed
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex > 0) {
    return `${trimmed.slice(0, dotIndex)}.txt`
  }
  return `${trimmed}.txt`
}

const NotepadWindow = ({ appWindow, actions, filesystem, ui }) => {
  const content = appWindow.content ?? ''
  const filename = appWindow.filename ?? 'Untitled.txt'
  const filePath = appWindow.path

  const openFileDialog = (mode) => {
    ui?.openFileDialog?.({
      mode,
      initialDirectory: getDirectoryPath(filePath) || '/home/Desktop',
      initialFilename: ensureTxtExtension(filename),
      normalizeFilename: ensureTxtExtension,
      filterEntry: (entry) =>
        entry.type === 'dir' ||
        entry.name.toLowerCase().endsWith('.txt'),
      onConfirm: (path) => {
        if (!path) return false
        if (mode === 'open') {
          const nextContent = filesystem.readFile(path)
          if (nextContent === null) return false
          actions.updateWindow(appWindow.id, {
            content: nextContent,
            filename: getBasename(path),
            path
          })
          return true
        }
        const nextName = ensureTxtExtension(getBasename(path))
        const nextPath = filesystem.joinPath(getDirectoryPath(path), nextName)
        filesystem.writeFile(nextPath, content)
        actions.updateWindow(appWindow.id, {
          filename: nextName,
          path: nextPath
        })
        return true
      }
    })
  }

  const handleOpen = () => {
    openFileDialog('open')
  }

  const handleSave = () => {
    if (
      filePath &&
      filesystem.pathExists(filePath) &&
      filePath.toLowerCase().endsWith('.txt')
    ) {
      const nextName = ensureTxtExtension(filename)
      filesystem.writeFile(filePath, content)
      actions.updateWindow(appWindow.id, { filename: nextName, path: filePath })
      return
    }
    openFileDialog('save')
  }

  const handleSaveAs = () => {
    openFileDialog('save')
  }

  return (
    <div className="notepad-shell">
      <div className="notepad-toolbar">
        <button type="button" onClick={handleOpen}>
          Open
        </button>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={handleSaveAs}>
          Save as
        </button>
      </div>
      <textarea
        className="notepad-textarea"
        value={content}
        onChange={(event) =>
          actions.updateWindow(appWindow.id, { content: event.target.value })
        }
        placeholder="Start typing..."
      />
    </div>
  )
}

const renderNotepad = (appWindow, { actions, filesystem, ui }) => (
  <NotepadWindow
    appWindow={appWindow}
    actions={actions}
    filesystem={filesystem}
    ui={ui}
  />
)

const AppStoreWindow = ({ actions, ui }) => {
  const [installedAppIds, setInstalledAppIds] = useState(getInstalledAppIds)
  const [wifiStatus, setWifiStatus] = useState(loadWifiStatus)
  const [downloadState, setDownloadState] = useState(() => ({}))
  const activeDownloadCount = Object.keys(downloadState).length
  const isDownloadingAny = activeDownloadCount > 0
  const iconDesignId = ui?.iconDesign ?? 'classic'

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const refresh = () => setInstalledAppIds(getInstalledAppIds())
    refresh()
    window.addEventListener(APP_INSTALLS_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(APP_INSTALLS_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const refresh = () => setWifiStatus(loadWifiStatus())
    refresh()
    window.addEventListener(WIFI_STATUS_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(WIFI_STATUS_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    if (!isDownloadingAny || typeof window === 'undefined') return undefined
    const timerId = window.setInterval(() => {
      const latestWifiStatus = loadWifiStatus()
      setWifiStatus(latestWifiStatus)
      const speedMbps = getWifiDownloadMbps(latestWifiStatus)
      setDownloadState((prev) => {
        const activeIds = Object.keys(prev)
        if (!activeIds.length || speedMbps <= 0) return prev
        const perAppSpeedMbps = speedMbps / activeIds.length
        const progressPerSecond =
          (perAppSpeedMbps / DEFAULT_APP_DOWNLOAD_SIZE_MB) * 100
        const deltaProgress = progressPerSecond * (DOWNLOAD_TICK_MS / 1000)
        if (deltaProgress <= 0) return prev
        const next = { ...prev }
        let changed = false
        activeIds.forEach((appId) => {
          const currentProgress = prev[appId]
          if (typeof currentProgress !== 'number') return
          const nextProgress = Math.min(currentProgress + deltaProgress, 100)
          if (nextProgress !== currentProgress) {
            next[appId] = nextProgress
            changed = true
          }
        })
        return changed ? next : prev
      })
    }, DOWNLOAD_TICK_MS)
    return () => window.clearInterval(timerId)
  }, [isDownloadingAny])

  useEffect(() => {
    const completedIds = Object.entries(downloadState)
      .filter(([, progress]) => progress >= 100)
      .map(([appId]) => appId)
    if (!completedIds.length) return

    let installedAny = false
    completedIds.forEach((appId) => {
      const installedApp = APP_STORE_CATALOG.find((app) => app.id === appId)
      if (!installedApp || isAppInstalled(appId)) return
      setAppInstalled(appId, true)
      installedAny = true
      pushNotification({
        id: `app-installed-${appId}-${Date.now()}`,
        title: 'Download Complete',
        body: `${installedApp.title} was installed and added to Desktop.`,
        time: 'Now'
      })
    })

    if (installedAny) {
      setInstalledAppIds(getInstalledAppIds())
    }

    setDownloadState((prev) => {
      const next = { ...prev }
      let changed = false
      completedIds.forEach((appId) => {
        if (!(appId in next)) return
        delete next[appId]
        changed = true
      })
      return changed ? next : prev
    })
  }, [downloadState])

  const handleInstall = (appId) => {
    if (!appId) return
    const alreadyInstalled =
      installedAppIds.includes(appId) || isAppInstalled(appId)
    if (alreadyInstalled) {
      setInstalledAppIds(getInstalledAppIds())
      return
    }
    setDownloadState((prev) => {
      if (typeof prev[appId] === 'number') return prev
      if (Object.keys(prev).length >= MAX_CONCURRENT_DOWNLOADS) return prev
      return { ...prev, [appId]: 0 }
    })
  }

  const handleOpenInstalled = (appId) => {
    if (!appId) return
    actions?.openWindow?.(appId)
  }

  const handleUninstallInstalled = (appId, appTitle) => {
    if (!appId) return
    const alreadyInstalled =
      installedAppIds.includes(appId) || isAppInstalled(appId)
    if (!alreadyInstalled) return
    setAppInstalled(appId, false)
    resetAppShortcutPath(appId)
    setInstalledAppIds(getInstalledAppIds())
    setDownloadState((prev) => {
      if (!(appId in prev)) return prev
      const next = { ...prev }
      delete next[appId]
      return next
    })
    pushNotification({
      id: `app-uninstalled-${appId}-${Date.now()}`,
      title: 'App Uninstalled',
      body: `${appTitle} was removed from Desktop.`,
      time: 'Now'
    })
  }

  const wifiSummary = !wifiStatus.enabled
    ? 'Wi-Fi: Off'
    : wifiStatus.connectedName
      ? `Wi-Fi: ${wifiStatus.connectedName} (${wifiStatus.signal ?? 'n/a'})`
      : 'Wi-Fi: Not connected'

  return (
    <div className="app-store-shell">
      <div className="app-store-title">App Store</div>
      <div className="app-store-subtitle">{wifiSummary}</div>
      <div className="app-store-list">
        {APP_STORE_CATALOG.map((app) => {
          const installed =
            installedAppIds.includes(app.id) || isAppInstalled(app.id)
          const activeProgress = downloadState[app.id]
          const isDownloading =
            typeof activeProgress === 'number' && !installed
          const speedMbps = isDownloading
            ? getWifiDownloadMbps(wifiStatus) / Math.max(activeDownloadCount, 1)
            : 0
          const progress = installed
            ? 100
            : isDownloading
              ? activeProgress
              : 0
          const iconSrc = `/icons/${iconDesignId}/${app.id}.svg`

          return (
            <div key={app.id} className="app-store-card">
              <img
                src={iconSrc}
                alt=""
                aria-hidden="true"
                className="app-store-app-icon"
              />
              <div className="app-store-app-main">
                <div className="app-store-app-name">{app.title}</div>
                <div className="app-store-app-note">
                  {installed
                    ? `Installed. ${app.description}`
                    : isDownloading
                      ? speedMbps > 0
                        ? `Downloading at ${speedMbps.toFixed(1)} MB/s`
                        : 'Waiting for Wi-Fi...'
                      : app.description}
                </div>
                <div className="app-store-progress">
                  <div
                    className={`app-store-progress-bar ${installed ? 'is-complete' : ''}`.trim()}
                    style={{
                      width: `${Math.round(progress)}%`
                    }}
                  />
                </div>
              </div>
              {installed ? (
                <div className="app-store-actions">
                  <button
                    type="button"
                    className="app-store-action"
                    onClick={() => handleOpenInstalled(app.id)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="app-store-action is-danger"
                    onClick={() => handleUninstallInstalled(app.id, app.title)}
                  >
                    Uninstall
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="app-store-action"
                  onClick={() => handleInstall(app.id)}
                  disabled={
                    !isDownloading &&
                    activeDownloadCount >= MAX_CONCURRENT_DOWNLOADS
                  }
                >
                  {isDownloading
                    ? `${Math.floor(activeProgress)}%`
                    : activeDownloadCount >= MAX_CONCURRENT_DOWNLOADS
                      ? 'Max 3'
                      : 'Install'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const renderAppStore = (_window, { actions, ui }) => (
  <AppStoreWindow actions={actions} ui={ui} />
)

const renderEmail = () => (
  <div className="window-empty">Email app coming soon.</div>
)

const renderFriendMedia = () => (
  <div className="window-empty">FriendMedia app coming soon.</div>
)

const renderBoxBrowser = () => (
  <div className="window-empty">BoxBrowser app coming soon.</div>
)

const ReminderWindow = () => {
  const [items, setItems] = useState(loadReminderItems)
  const [isBoardVisible, setIsBoardVisible] = useState(loadReminderBoardVisible)
  const [draft, setDraft] = useState('')
  const [pendingText, setPendingText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [scheduleDate, setScheduleDate] = useState(() =>
    toDateInputValue(new Date())
  )
  const [scheduleTime, setScheduleTime] = useState(() =>
    toTimeInputValue(new Date())
  )
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    saveReminderBoardVisible(isBoardVisible)
  }, [isBoardVisible])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncFromStorage = () => {
      const latestItems = loadReminderItems()
      setItems((prevItems) => {
        const prevSnapshot = JSON.stringify(prevItems)
        const latestSnapshot = JSON.stringify(latestItems)
        return prevSnapshot === latestSnapshot ? prevItems : latestItems
      })
    }
    const timerId = window.setInterval(
      syncFromStorage,
      REMINDER_SYNC_INTERVAL_MS
    )
    return () => window.clearInterval(timerId)
  }, [])

  const openCreateScheduleTab = () => {
    const text = draft.trim()
    if (!text) return
    const now = new Date()
    setEditingId(null)
    setPendingText(text)
    setScheduleDate(toDateInputValue(now))
    setScheduleTime(toTimeInputValue(now))
    setIsScheduleOpen(true)
  }

  const openEditScheduleTab = (item) => {
    if (!item) return
    const nextText =
      typeof item.text === 'string' ? item.text.trim() : ''
    if (!nextText) return
    const dueDate =
      typeof item.dueAt === 'string' && item.dueAt
        ? new Date(item.dueAt)
        : new Date()
    const isValidDue = !Number.isNaN(dueDate.getTime())
    const fallbackDate = new Date()
    const sourceDate = isValidDue ? dueDate : fallbackDate
    setEditingId(item.id)
    setPendingText(nextText)
    setScheduleDate(toDateInputValue(sourceDate))
    setScheduleTime(toTimeInputValue(sourceDate))
    setIsScheduleOpen(true)
  }

  const closeScheduleTab = () => {
    setPendingText('')
    setEditingId(null)
    setIsScheduleOpen(false)
  }

  const saveReminderWithSchedule = (event) => {
    event.preventDefault()
    const text = pendingText.trim()
    if (!text) {
      closeScheduleTab()
      return
    }
    const dueDate = buildReminderDueDate(scheduleDate, scheduleTime)
    if (!dueDate) return
    const dueAt = dueDate.toISOString()
    const dueLabel = formatReminderDueLabel(dueDate)
    if (editingId) {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                text,
                done: false,
                dueAt,
                dueLabel,
                warningSentAt: null,
                autoCompletedAt: null
              }
            : entry
        )
      )
    } else {
      const createdAt = REMINDER_CREATED_FORMATTER.format(new Date())
      setItems((prev) => [
        {
          id: `reminder-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          text,
          done: false,
          createdAt,
          dueAt,
          dueLabel,
          warningSentAt: null,
          autoCompletedAt: null
        },
        ...prev
      ])
      setDraft('')
    }
    closeScheduleTab()
  }

  return (
    <div className="reminder-shell">
      <div className="reminder-header">
        <div className="reminder-title">Reminders</div>
        <button
          type="button"
          className={`reminder-board-toggle ${isBoardVisible ? 'is-on' : 'is-off'}`.trim()}
          onClick={() => setIsBoardVisible((prev) => !prev)}
        >
          Board: {isBoardVisible ? 'On' : 'Off'}
        </button>
      </div>
      <div className="reminder-add-row">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a reminder..."
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              openCreateScheduleTab()
            }
          }}
        />
        <button type="button" onClick={openCreateScheduleTab}>
          Add
        </button>
      </div>
      <div className="reminder-list">
        {items.length === 0 ? (
          <div className="reminder-empty">No reminders yet.</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`reminder-item ${item.done ? 'is-done' : ''}`.trim()}
            >
              <button
                type="button"
                className="reminder-toggle"
                onClick={() =>
                  setItems((prev) =>
                    prev.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, done: !entry.done }
                        : entry
                    )
                  )
                }
                aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
              >
                {item.done ? 'Undo' : 'Done'}
              </button>
              <div className="reminder-main">
                <div className="reminder-text">{item.text}</div>
                <div className="reminder-meta">
                  Due: {item.dueLabel ?? 'No date set'}
                </div>
                <div className="reminder-meta is-secondary">
                  Added: {item.createdAt}
                </div>
              </div>
              <button
                type="button"
                className="reminder-edit"
                onClick={() => openEditScheduleTab(item)}
              >
                Edit
              </button>
              <button
                type="button"
                className="reminder-delete"
                onClick={() =>
                  setItems((prev) =>
                    prev.filter((entry) => entry.id !== item.id)
                  )
                }
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
      {isScheduleOpen ? (
        <div
          className="reminder-schedule-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Reminder date and time"
        >
          <form className="reminder-schedule-card" onSubmit={saveReminderWithSchedule}>
            <div className="reminder-schedule-title">
              {editingId ? 'Edit reminder' : 'Set reminder date and time'}
            </div>
            <label className="reminder-schedule-field">
              <span>Reminder</span>
              <input
                type="text"
                value={pendingText}
                onChange={(event) => setPendingText(event.target.value)}
                required
              />
            </label>
            <label className="reminder-schedule-field">
              <span>Day / Date</span>
              <input
                type="date"
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
                required
              />
            </label>
            <label className="reminder-schedule-field">
              <span>Time</span>
              <input
                type="time"
                value={scheduleTime}
                onChange={(event) => setScheduleTime(event.target.value)}
                required
              />
            </label>
            <div className="reminder-schedule-actions">
              <button type="button" onClick={closeScheduleTab}>
                Cancel
              </button>
              <button type="submit" className="is-primary">
                {editingId ? 'Save changes' : 'Save reminder'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

const renderReminder = () => <ReminderWindow />

const renderFileDialog = (appWindow, { filesystem, actions }) => {
  const payload = appWindow.payload ?? {}
  const handleConfirm = (path) => {
    const result = payload.onConfirm?.(path)
    if (result === false) return false
    actions.closeWindow(appWindow.id)
    return true
  }

  return (
    <FileDialog
      embedded
      mode={payload.mode ?? 'open'}
      filesystem={filesystem}
      initialDirectory={payload.initialDirectory}
      initialFilename={payload.initialFilename}
      normalizeFilename={payload.normalizeFilename}
      filterEntry={payload.filterEntry}
      onConfirm={handleConfirm}
      onCancel={() => actions.closeWindow(appWindow.id)}
      title={payload.title ?? appWindow.title}
    />
  )
}

const renderConfirmDialog = (appWindow, { actions }) => {
  const payload = appWindow.payload ?? {}
  const handleConfirm = () => {
    payload.onConfirm?.()
    actions.closeWindow(appWindow.id)
  }

  return (
    <ConfirmDialog
      title={payload.title ?? appWindow.title}
      message={payload.message}
      confirmLabel={payload.confirmLabel}
      cancelLabel={payload.cancelLabel}
      tone={payload.tone}
      onConfirm={handleConfirm}
      onCancel={() => actions.closeWindow(appWindow.id)}
    />
  )
}

const renderResetProgress = () => (
  <div className="reset-progress">
    <div className="reset-progress-title">Deleting and cleaning up data...</div>
    <div className="reset-progress-spinner" aria-hidden="true" />
    <div className="reset-progress-text">
      Please wait. This will take a moment.
    </div>
  </div>
)

const BackgroundPickerWindow = ({ ui }) => {
  const options = ui?.backgroundOptions ?? []
  const activeBackground = ui?.desktopBackground
  const iconDesignOptions = ui?.iconDesignOptions ?? []
  const activeIconDesign = ui?.iconDesign

  return (
    <div className="background-picker">
      <div className="background-picker-section">
        <div className="background-picker-title">Choose Background</div>
        <div className="background-picker-grid">
          {options.map((option) => {
            const isActive = option.src === activeBackground
            return (
              <button
                key={option.id}
                type="button"
                className={`background-option ${isActive ? 'is-active' : ''}`.trim()}
                onClick={() => ui?.setDesktopBackground?.(option.src)}
              >
                <img src={option.src} alt="" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="background-picker-section">
        <div className="background-picker-title">Icon Design</div>
        <div className="icon-design-grid">
          {iconDesignOptions.map((option) => {
            const isActive = option.id === activeIconDesign
            return (
              <button
                key={option.id}
                type="button"
                className={`icon-design-option ${isActive ? 'is-active' : ''}`.trim()}
                onClick={() => ui?.setIconDesign?.(option.id)}
              >
                <span className="icon-design-preview" aria-hidden="true">
                  {option.previewSrc ? (
                    <img src={option.previewSrc} alt="" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="icon-design-label">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const renderBackgroundPicker = (_window, { ui }) => (
  <BackgroundPickerWindow ui={ui} />
)

export const APP_LIST = [
  {
    id: 'computer',
    title: 'My Computer',
    iconClass: 'computer',
    Icon: ComputerIcon,
    showOnDesktop: true,
    showInContextMenu: false,
    taskbarLabel: 'PC',
    maxInstances: Infinity,
    window: { width: 520, height: 360, x: 220, y: 110 },
    render: renderComputer
  },
  {
    id: 'folder',
    title: 'Case Files',
    iconClass: 'folder',
    Icon: FolderIcon,
    showOnDesktop: true,
    showInContextMenu: false,
    taskbarLabel: 'CF',
    maxInstances: Infinity,
    window: { width: 520, height: 360, x: 260, y: 140 },
    render: () => <EmptyState />
  },
  {
    id: 'trash',
    title: 'Trash',
    iconClass: 'trash',
    Icon: TrashIcon,
    showOnDesktop: true,
    showInContextMenu: false,
    taskbarLabel: 'TR',
    maxInstances: Infinity,
    window: { width: 520, height: 360, x: 300, y: 160 },
    render: renderTrash
  },
  {
    id: 'notepad',
    title: 'Notepad',
    iconClass: 'notepad',
    Icon: NotepadIcon,
    showOnDesktop: true,
    showInContextMenu: false,
    taskbarLabel: 'NP',
    maxInstances: Infinity,
    window: {
      width: 640,
      height: 420,
      x: 240,
      y: 140,
      content: '',
      filename: 'Untitled.txt',
      path: null
    },
    render: renderNotepad
  },
  {
    id: 'appStore',
    title: 'App Store',
    iconClass: 'app-store',
    Icon: AppStoreIcon,
    showOnDesktop: true,
    showInContextMenu: false,
    taskbarLabel: 'AS',
    maxInstances: Infinity,
    window: { width: 560, height: 380, x: 290, y: 150 },
    render: renderAppStore
  },
  {
    id: EMAIL_APP_ID,
    title: 'Email',
    iconClass: 'email',
    Icon: EmailIcon,
    showOnDesktop: false,
    installable: true,
    showInContextMenu: false,
    taskbarLabel: 'EM',
    maxInstances: Infinity,
    window: { width: 560, height: 380, x: 320, y: 170 },
    render: renderEmail
  },
  {
    id: REMINDER_APP_ID,
    title: 'Reminder',
    iconClass: 'reminder',
    Icon: ReminderIcon,
    showOnDesktop: false,
    installable: true,
    showInContextMenu: false,
    taskbarLabel: 'RM',
    maxInstances: Infinity,
    window: { width: 560, height: 400, x: 340, y: 180 },
    render: renderReminder
  },
  {
    id: FRIEND_MEDIA_APP_ID,
    title: 'FriendMedia',
    iconClass: 'friend-media',
    Icon: FriendMediaIcon,
    showOnDesktop: false,
    installable: true,
    showInContextMenu: false,
    taskbarLabel: 'FM',
    maxInstances: Infinity,
    window: { width: 780, height: 520, x: 280, y: 150 },
    render: renderFriendMedia
  },
  {
    id: BOX_BROWSER_APP_ID,
    title: 'BoxBrowser',
    iconClass: 'box-browser',
    Icon: BoxBrowserIcon,
    showOnDesktop: false,
    installable: true,
    showInContextMenu: false,
    taskbarLabel: 'BB',
    maxInstances: Infinity,
    window: { width: 860, height: 560, x: 240, y: 120 },
    render: renderBoxBrowser
  },
  {
    id: 'settings',
    title: 'Settings',
    iconClass: 'settings',
    Icon: SettingsIcon,
    showOnDesktop: false,
    showInContextMenu: true,
    taskbarLabel: 'ST',
    maxInstances: Infinity,
    window: { width: 460, height: 320, x: 280, y: 160 },
    render: renderSettings
  },
  {
    id: 'fileDialog',
    title: 'File Dialog',
    iconClass: null,
    Icon: null,
    showOnDesktop: false,
    showInContextMenu: false,
    taskbarLabel: 'DLG',
    maxInstances: 5,
    window: { width: 540, height: 420, x: 260, y: 140 },
    render: renderFileDialog
  },
  {
    id: 'confirmDialog',
    title: 'Confirm',
    iconClass: null,
    Icon: null,
    showOnDesktop: false,
    showInContextMenu: false,
    taskbarLabel: 'DLG',
    maxInstances: 5,
    window: { width: 420, height: 220, x: 300, y: 180 },
    render: renderConfirmDialog
  },
  {
    id: 'resetProgress',
    title: 'Resetting',
    iconClass: null,
    Icon: null,
    showOnDesktop: false,
    showInContextMenu: false,
    taskbarLabel: 'SYS',
    maxInstances: 1,
    window: { width: 380, height: 200, x: 320, y: 200 },
    render: renderResetProgress
  },
  {
    id: 'backgroundPicker',
    title: 'Change Background',
    iconClass: 'settings',
    Icon: BackgroundIcon,
    showOnDesktop: false,
    showInContextMenu: false,
    taskbarLabel: 'BG',
    maxInstances: Infinity,
    window: { width: 560, height: 360, x: 300, y: 170 },
    render: renderBackgroundPicker
  }
]

export const APP_BY_ID = APP_LIST.reduce((acc, app) => {
  acc[app.id] = app
  return acc
}, {})

export const getAppDefinition = (id) => APP_BY_ID[id]

export const getDesktopApps = (installedAppIds = []) =>
  APP_LIST.filter(
    (app) =>
      app.showOnDesktop ||
      (app.installable === true && installedAppIds.includes(app.id))
  )

export const getContextMenuApps = () =>
  APP_LIST.filter((app) => app.showInContextMenu)
