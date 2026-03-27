import { useEffect, useRef, useState } from 'react'
import { getAppDefinition, getContextMenuApps } from '../apps/registry'
import { ContextMenuProvider, useContextMenu } from '../components/ContextMenuProvider'
import { DesktopIconLayer } from '../components/DesktopIconLayer'
import { Taskbar } from '../components/Taskbar'
import { DesktopWindow } from '../components/DesktopWindow'
import { useDesktopItems } from '../hooks/useDesktopItems'
import { useWindowManager } from '../hooks/useWindowManager'
import { moveEntryToDirectory, renameEntry, trashEntry } from '../state/fileActions'
import {
  APP_INSTALLS_CHANGED_EVENT,
  isAppInstalled,
  setAppInstalled
} from '../state/appInstallations'
import {
  DEFAULT_APP_DOWNLOAD_SIZE_MB,
  DOWNLOAD_TICK_MS,
  getWifiDownloadMbps,
  loadAppDownloads,
  updateAppDownloads
} from '../state/appDownloads'
import { resetAppShortcutPath, setAppShortcutPath } from '../state/appShortcuts'
import { useFilesystem } from '../state/filesystemContext'
import { pushNotification } from '../state/notifications'
import { useResolution } from '../state/resolutionContext'
import { loadWifiStatus } from '../state/wifiStatus'
import '../styles/desktop.css'

const WINDOW_CLOSE_DURATION = 220
const BACKGROUND_STORAGE_KEY = 'detective-os.desktop.background.v1'
const ICON_DESIGN_STORAGE_KEY = 'detective-os.desktop.icon-design.v1'
const REMINDER_APP_ID = 'reminder'
const REMINDERS_STORAGE_KEY = 'detective-os.reminders.v1'
const REMINDER_BOARD_VISIBLE_STORAGE_KEY = 'detective-os.reminders.board.visible.v1'
const REMINDER_BOARD_VISIBILITY_CHANGED_EVENT =
  'detective-os:reminder-board-visibility-changed'
const REMINDER_BOARD_MAX_ITEMS = 5
const REMINDER_BOARD_SYNC_MS = 2000
const REMINDER_BOARD_TRANSITION_MS = 240
const BACKGROUND_OPTIONS = [
  { id: 'classic', label: 'Classic Noir', src: '/wallpaper.jpg' },
  { id: 'grid', label: 'Noir Grid', src: '/backgrounds/noir-grid.svg' },
  { id: 'sunset', label: 'Retro Sunset', src: '/backgrounds/retro-sunset.svg' },
  { id: 'city', label: 'City Night', src: '/backgrounds/city-night.svg' },
  { id: 'forest', label: 'Misty Forest', src: '/backgrounds/misty-forest.svg' },
  { id: 'dunes', label: 'Amber Dunes', src: '/backgrounds/amber-dunes.svg' },
  { id: 'glacier', label: 'Glacier Lake', src: '/backgrounds/glacier-lake.svg' }
]
const ICON_DESIGN_OPTIONS = [
  { id: 'classic', label: 'Classic Icons', previewSrc: '/icons/classic/folder.svg' },
  { id: 'soft', label: 'Soft Icons', previewSrc: '/icons/soft/folder.svg' },
  { id: 'cyber', label: 'Cyber Icons', previewSrc: '/icons/cyber/folder.svg' },
  { id: 'midnight', label: 'Midnight Icons', previewSrc: '/icons/midnight/folder.svg' },
  { id: 'candy', label: 'Candy Icons', previewSrc: '/icons/candy/folder.svg' },
  { id: 'matrix', label: 'Matrix Icons', previewSrc: '/icons/matrix/folder.svg' }
]
const DEFAULT_BACKGROUND = BACKGROUND_OPTIONS[0].src
const DEFAULT_ICON_DESIGN = ICON_DESIGN_OPTIONS[0].id

const isValidBackground = (src) =>
  BACKGROUND_OPTIONS.some((option) => option.src === src)
const isValidIconDesign = (id) =>
  ICON_DESIGN_OPTIONS.some((option) => option.id === id)

const loadInitialBackground = () => {
  if (typeof window === 'undefined') return DEFAULT_BACKGROUND
  const stored = window.localStorage.getItem(BACKGROUND_STORAGE_KEY)
  if (!stored) return DEFAULT_BACKGROUND
  return isValidBackground(stored) ? stored : DEFAULT_BACKGROUND
}

const loadInitialIconDesign = () => {
  if (typeof window === 'undefined') return DEFAULT_ICON_DESIGN
  const stored = window.localStorage.getItem(ICON_DESIGN_STORAGE_KEY)
  if (!stored) return DEFAULT_ICON_DESIGN
  return isValidIconDesign(stored) ? stored : DEFAULT_ICON_DESIGN
}

const getReminderDueTimestamp = (item) => {
  if (typeof item?.dueAt !== 'string' || !item.dueAt) return Number.POSITIVE_INFINITY
  const timestamp = Date.parse(item.dueAt)
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

const loadDesktopReminderItems = () => {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(REMINDERS_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id:
          typeof item.id === 'string' && item.id
            ? item.id
            : `reminder-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        text:
          typeof item.text === 'string' ? item.text.trim() : '',
        dueLabel:
          typeof item.dueLabel === 'string' && item.dueLabel.trim()
            ? item.dueLabel.trim()
            : null,
        dueAt:
          typeof item.dueAt === 'string' && item.dueAt
            ? item.dueAt
            : null,
        done: item.done === true
      }))
      .filter((item) => item.text && item.done !== true)
      .sort((leftItem, rightItem) => {
        const leftDue = getReminderDueTimestamp(leftItem)
        const rightDue = getReminderDueTimestamp(rightItem)
        return leftDue - rightDue
      })
      .slice(0, REMINDER_BOARD_MAX_ITEMS)
  } catch {
    return []
  }
}

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

function DesktopSurface({ viewportRef }) {
  const { openContextMenu, closeMenu } = useContextMenu()
  const [closingIds, setClosingIds] = useState(() => new Set())
  const [desktopBackground, setDesktopBackground] = useState(loadInitialBackground)
  const [iconDesign, setIconDesign] = useState(loadInitialIconDesign)
  const [isReminderInstalled, setIsReminderInstalled] = useState(() =>
    isAppInstalled(REMINDER_APP_ID)
  )
  const [isReminderBoardVisible, setIsReminderBoardVisible] = useState(
    loadReminderBoardVisible
  )
  const [reminderBoardItems, setReminderBoardItems] = useState(
    loadDesktopReminderItems
  )
  const shouldShowReminderBoard =
    isReminderInstalled && isReminderBoardVisible && reminderBoardItems.length > 0
  const [isReminderBoardRendered, setIsReminderBoardRendered] = useState(
    shouldShowReminderBoard
  )
  const [isReminderBoardShown, setIsReminderBoardShown] = useState(
    shouldShowReminderBoard
  )
  const resolution = useResolution()
  const filesystem = useFilesystem()
  const {
    windows,
    openWindow,
    bringToFront,
    closeWindow,
    toggleMinimize,
    toggleMaximize,
    startDrag,
    startResize,
    updateWindow
  } = useWindowManager(viewportRef)

  const contextMenuApps = getContextMenuApps()
  const { items: iconItems, openFile } = useDesktopItems({ openWindow })

  const startFactoryReset = () => {
    if (typeof window === 'undefined') return
    openWindow('resetProgress', {
      title: 'Resetting'
    })
    setTimeout(() => {
      window.localStorage.clear()
      window.location.reload()
    }, 3500)
  }

  const openFileDialog = (config) => {
    openWindow('fileDialog', {
      title: config.title ?? (config.mode === 'open' ? 'Open File' : 'Save File'),
      width: config.width ?? 540,
      height: config.height ?? 420,
      payload: config
    })
  }

  const openConfirm = (config) => {
    openWindow('confirmDialog', {
      title: config.title ?? 'Confirm',
      width: config.width ?? 420,
      height: config.height ?? 220,
      payload: config
    })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(BACKGROUND_STORAGE_KEY, desktopBackground)
  }, [desktopBackground])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ICON_DESIGN_STORAGE_KEY, iconDesign)
  }, [iconDesign])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncInstalled = () => setIsReminderInstalled(isAppInstalled(REMINDER_APP_ID))
    syncInstalled()
    window.addEventListener(APP_INSTALLS_CHANGED_EVENT, syncInstalled)
    window.addEventListener('storage', syncInstalled)
    return () => {
      window.removeEventListener(APP_INSTALLS_CHANGED_EVENT, syncInstalled)
      window.removeEventListener('storage', syncInstalled)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncReminders = () => {
      const latestItems = loadDesktopReminderItems()
      const latestSnapshot = JSON.stringify(latestItems)
      setReminderBoardItems((prevItems) => {
        const prevSnapshot = JSON.stringify(prevItems)
        return prevSnapshot === latestSnapshot ? prevItems : latestItems
      })
    }
    syncReminders()
    const timerId = window.setInterval(syncReminders, REMINDER_BOARD_SYNC_MS)
    window.addEventListener('storage', syncReminders)
    return () => {
      window.clearInterval(timerId)
      window.removeEventListener('storage', syncReminders)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncVisibility = () => setIsReminderBoardVisible(loadReminderBoardVisible())
    syncVisibility()
    window.addEventListener(REMINDER_BOARD_VISIBILITY_CHANGED_EVENT, syncVisibility)
    window.addEventListener('storage', syncVisibility)
    return () => {
      window.removeEventListener(
        REMINDER_BOARD_VISIBILITY_CHANGED_EVENT,
        syncVisibility
      )
      window.removeEventListener('storage', syncVisibility)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let lastTickMs = Date.now()

    const processDownloads = () => {
      const nowMs = Date.now()
      const elapsedMs = Math.max(nowMs - lastTickMs, 0)
      lastTickMs = nowMs
      if (elapsedMs <= 0) return

      const wifiStatus = loadWifiStatus()
      const totalSpeedMbps = getWifiDownloadMbps(wifiStatus)
      if (totalSpeedMbps <= 0) return

      const completedAppIds = []
      updateAppDownloads((prev) => {
        const activeIds = Object.keys(prev)
        if (!activeIds.length) return prev

        const perAppSpeedMbps = totalSpeedMbps / activeIds.length
        const progressPerSecond =
          (perAppSpeedMbps / DEFAULT_APP_DOWNLOAD_SIZE_MB) * 100
        const deltaProgress = progressPerSecond * (elapsedMs / 1000)
        if (deltaProgress <= 0) return prev

        const next = { ...prev }
        let changed = false
        activeIds.forEach((appId) => {
          const currentProgress = prev[appId]
          if (typeof currentProgress !== 'number') return
          const nextProgress = Math.min(currentProgress + deltaProgress, 100)
          if (nextProgress >= 100) {
            delete next[appId]
            completedAppIds.push(appId)
            changed = true
            return
          }
          if (nextProgress !== currentProgress) {
            next[appId] = nextProgress
            changed = true
          }
        })
        return changed ? next : prev
      })

      if (!completedAppIds.length) return
      completedAppIds.forEach((appId) => {
        if (!appId || isAppInstalled(appId)) return
        setAppInstalled(appId, true)
        const appTitle = getAppDefinition(appId)?.title ?? 'App'
        pushNotification({
          id: `app-installed-${appId}-${Date.now()}`,
          title: 'Download Complete',
          body: `${appTitle} was installed and added to Desktop.`,
          time: 'Now'
        })
      })
    }

    const timerId = window.setInterval(processDownloads, DOWNLOAD_TICK_MS)
    const handleVisibilityChange = () => {
      if (document.hidden) return
      processDownloads()
    }
    window.addEventListener('focus', processDownloads)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (Object.keys(loadAppDownloads()).length > 0) {
      processDownloads()
    }

    return () => {
      window.clearInterval(timerId)
      window.removeEventListener('focus', processDownloads)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (shouldShowReminderBoard) {
      setIsReminderBoardRendered(true)
      if (typeof window === 'undefined') {
        setIsReminderBoardShown(true)
        return undefined
      }
      const animationFrameId = window.requestAnimationFrame(() => {
        setIsReminderBoardShown(true)
      })
      return () => {
        window.cancelAnimationFrame(animationFrameId)
      }
    }

    setIsReminderBoardShown(false)
    if (typeof window === 'undefined') {
      setIsReminderBoardRendered(false)
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setIsReminderBoardRendered(false)
    }, REMINDER_BOARD_TRANSITION_MS)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [shouldShowReminderBoard])

  const applyDesktopBackground = (src) => {
    if (!isValidBackground(src)) return
    setDesktopBackground(src)
  }

  const applyIconDesign = (designId) => {
    if (!isValidIconDesign(designId)) return
    setIconDesign(designId)
  }

  const ui = {
    openFileDialog,
    openConfirm,
    startFactoryReset,
    desktopBackground,
    backgroundOptions: BACKGROUND_OPTIONS,
    setDesktopBackground: applyDesktopBackground,
    iconDesign,
    iconDesignOptions: ICON_DESIGN_OPTIONS,
    setIconDesign: applyIconDesign
  }

  useEffect(() => {
    setClosingIds((prev) => {
      if (!prev.size) return prev
      const activeIds = new Set(windows.map((appWindow) => appWindow.id))
      let changed = false
      const next = new Set()
      prev.forEach((id) => {
        if (activeIds.has(id)) {
          next.add(id)
          return
        }
        changed = true
      })
      return changed ? next : prev
    })
  }, [windows])

  const handleContextMenu = (event) => {
    const createDesktopFolder = () => {
      const baseName = 'New Folder'
      let attempt = 0
      while (attempt < 100) {
        const folderName =
          attempt === 0 ? baseName : `${baseName} (${attempt})`
        const folderPath = filesystem.joinPath('/home/Desktop', folderName)
        if (!filesystem.pathExists(folderPath)) {
          filesystem.createDir(folderPath)
          return
        }
        attempt += 1
      }
      filesystem.createDir(
        filesystem.joinPath('/home/Desktop', `${baseName} ${Date.now()}`)
      )
    }

    const items = [
      ...contextMenuApps.map((app) => ({
        label: `Open ${app.title}`,
        onSelect: () => openWindow(app.id)
      })),
      {
        label: 'New Folder',
        onSelect: createDesktopFolder
      },
      {
        label: 'Change Background',
        onSelect: () => openWindow('backgroundPicker')
      }
    ]

    if (!items.length) return
    openContextMenu({
      event,
      items
    })
  }

  const handleFileContextMenu = (event, entry) => {
    if (!entry || (entry.type !== 'file' && entry.type !== 'dir')) return
    const requestRenameFolder = () => {
      if (entry.type !== 'dir' || typeof window === 'undefined') return false
      const proposedName = window.prompt('Rename folder', entry.name ?? 'New Folder')
      if (proposedName === null) return false
      const nextName = proposedName.trim()
      if (!nextName || nextName === entry.name) return false
      const renamed = renameEntry(entry, nextName, { filesystem })
      if (!renamed) {
        pushNotification({
          id: `rename-failed-${entry.path}-${Date.now()}`,
          title: 'Rename Failed',
          body: 'Could not rename folder. The name may be invalid or already used.',
          time: 'Now'
        })
        return false
      }
      pushNotification({
        id: `folder-renamed-${entry.path}-${Date.now()}`,
        title: 'Folder Renamed',
        body: `"${entry.name}" renamed to "${nextName}".`,
        time: 'Now'
      })
      return true
    }
    openContextMenu({
      event,
      width: 160,
      height: 48,
      items:
        entry.type === 'dir'
          ? [
              {
                label: 'Rename',
                onSelect: requestRenameFolder
              },
              {
                label: 'Delete',
                onSelect: () => trashEntry(entry, { filesystem })
              }
            ]
          : [
              {
                label: 'Delete',
                onSelect: () => trashEntry(entry, { filesystem })
              }
            ]
    })
  }

  const handleEntryDropToTrash = (entry) => {
    if (!entry || (entry.type !== 'file' && entry.type !== 'dir')) return false
    return trashEntry(entry, { filesystem })
  }

  const handleEntryDropToFolder = (entry, targetFolder) => {
    if (!entry || !targetFolder || targetFolder.type !== 'dir') return false
    return moveEntryToDirectory(entry, targetFolder.path, { filesystem })
  }

  const handleAppDropToFolder = (app, targetFolder) => {
    if (!app || !targetFolder || targetFolder.type !== 'dir') return false
    if (!filesystem.isDir(targetFolder.path)) return false
    return setAppShortcutPath(app.id, targetFolder.path)
  }

  const handleAppContextMenu = (event, app) => {
    if (!app) return
    if (app.id === 'trash') {
      const trashEntries = filesystem
        .listDir('/home/Trash')
        .filter((entry) => entry.type === 'file' || entry.type === 'dir')
      openContextMenu({
        event,
        width: 180,
        height: 44,
        items: [
          {
            label: 'Empty Trash',
            disabled: trashEntries.length === 0,
            onSelect: () => {
              if (!trashEntries.length) return
              openConfirm({
                title: 'Empty Trash',
                message:
                  'This will permanently delete all files and folders in Trash. This action cannot be undone.',
                confirmLabel: 'Delete all',
                cancelLabel: 'Cancel',
                tone: 'danger',
                onConfirm: () => {
                  trashEntries.forEach((entry) => filesystem.deleteFile(entry.path))
                }
              })
            }
          }
        ]
      })
      return
    }

    if (!app.installable || !isAppInstalled(app.id)) return

    openContextMenu({
      event,
      width: 190,
      items: [
        {
          label: `Open ${app.title}`,
          onSelect: () => openWindow(app.id)
        },
        {
          label: `Uninstall ${app.title}`,
          onSelect: () =>
            openConfirm({
              title: `Uninstall ${app.title}`,
              message: `${app.title} will be removed from Desktop until installed again from App Store.`,
              confirmLabel: 'Uninstall',
              cancelLabel: 'Cancel',
              tone: 'danger',
              onConfirm: () => {
                setAppInstalled(app.id, false)
                resetAppShortcutPath(app.id)
                pushNotification({
                  id: `app-uninstalled-${app.id}-${Date.now()}`,
                  title: 'App Uninstalled',
                  body: `${app.title} was removed.`,
                  time: 'Now'
                })
              }
            })
        }
      ]
    })
  }

  const handleBackgroundMouseDown = () => {
    closeMenu()
  }

  const requestCloseWindow = (id) => {
    if (!id) return
    if (typeof window === 'undefined') {
      closeWindow(id)
      return
    }
    setClosingIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    window.setTimeout(() => {
      closeWindow(id)
      setClosingIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, WINDOW_CLOSE_DURATION)
  }

  const renderWindowContent = (appWindow) => {
    const appDefinition = getAppDefinition(appWindow.type)
    if (!appDefinition?.render) {
      return <div className="window-empty">No content yet.</div>
    }
    return appDefinition.render(appWindow, {
      resolution,
      filesystem,
      actions: { updateWindow, closeWindow: requestCloseWindow, openWindow },
      ui
    })
  }

  return (
    <div
      className="viewport desktop-screen"
      ref={viewportRef}
      onContextMenu={handleContextMenu}
      onMouseDown={handleBackgroundMouseDown}
      data-icon-design={iconDesign}
      style={{ '--desktop-background-image': `url(${desktopBackground})` }}
    >
      <DesktopIconLayer
        viewportRef={viewportRef}
        items={iconItems}
        onOpenApp={openWindow}
        onOpenFile={openFile}
        onAppContextMenu={handleAppContextMenu}
        onAppDropToFolder={handleAppDropToFolder}
        onEntryDropToTrash={handleEntryDropToTrash}
        onEntryDropToFolder={handleEntryDropToFolder}
        onFileContextMenu={handleFileContextMenu}
      />
      {isReminderBoardRendered ? (
        <section
          className={`desktop-reminder-board ${
            isReminderBoardShown ? 'is-visible' : ''
          }`.trim()}
          aria-label="Reminder board"
        >
          <div className="desktop-reminder-board-title">Reminder Board</div>
          <div className="desktop-reminder-board-list">
            {reminderBoardItems.map((item) => (
              <div key={item.id} className="desktop-reminder-board-item">
                <div className="desktop-reminder-board-text">{item.text}</div>
                <div className="desktop-reminder-board-time">
                  {item.dueLabel ?? 'No due time'}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {windows
        .filter((appWindow) => !appWindow.isMinimized)
        .map((appWindow) => {
          const style = appWindow.isMaximized
            ? { zIndex: appWindow.zIndex }
            : {
                top: appWindow.y,
                left: appWindow.x,
                width: appWindow.width,
                height: appWindow.height,
                zIndex: appWindow.zIndex
              }
          return (
            <DesktopWindow
              key={appWindow.id}
              appWindow={appWindow}
              style={style}
              className={closingIds.has(appWindow.id) ? 'is-closing' : ''}
              onFocus={() => bringToFront(appWindow.id)}
              onDragStart={(event) => startDrag(event, appWindow)}
              onResizeStart={(event) => startResize(event, appWindow)}
              onMinimize={() => toggleMinimize(appWindow.id)}
              onMaximize={() => toggleMaximize(appWindow.id)}
              onClose={() => requestCloseWindow(appWindow.id)}
            >
              {renderWindowContent(appWindow)}
            </DesktopWindow>
          )
        })}
      <Taskbar
        windows={windows}
        onToggleMinimize={toggleMinimize}
        onBringToFront={bringToFront}
        panelRootRef={viewportRef}
      />
    </div>
  )
}

export function DesktopScreen() {
  const viewportRef = useRef(null)

  return (
    <main className="app">
      <ContextMenuProvider rootRef={viewportRef}>
        <DesktopSurface viewportRef={viewportRef} />
      </ContextMenuProvider>
    </main>
  )
}
