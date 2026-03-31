import { useEffect, useMemo, useRef, useState } from 'react'
import { getAppDefinition, getDesktopApps } from '../apps/registry'
import {
  openFileEntry,
  renameEntry,
  restoreEntry,
  trashEntry
} from '../state/fileActions'
import { getFileAssociation } from '../state/fileAssociations'
import {
  APP_INSTALLS_CHANGED_EVENT,
  getInstalledAppIds
} from '../state/appInstallations'
import {
  APP_SHORTCUTS_CHANGED_EVENT,
  getAppShortcutPath,
  loadAppShortcutPaths
} from '../state/appShortcuts'
import { useContextMenu } from './ContextMenuProvider'
import '../styles/file-explorer.css'

const FolderIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 20a4 4 0 0 1 4-4h14l6 6h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z" />
    <path d="M8 24h48v8H8z" />
  </svg>
)

export function FileExplorer({
  filesystem,
  openWindow,
  ui,
  startPath = '/',
  watchPath = null,
  onWatchPathMissing = null
}) {
  const { openContextMenu, closeMenu } = useContextMenu()
  const missingNotifiedRef = useRef(false)
  const [navState, setNavState] = useState(() => ({
    stack: [startPath],
    index: 0
  }))
  const [installedAppIds, setInstalledAppIds] = useState(getInstalledAppIds)
  const [appShortcutPaths, setAppShortcutPaths] = useState(loadAppShortcutPaths)

  const currentPath = navState.stack[navState.index] ?? '/'
  const canGoBack = navState.index > 0

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
    const refresh = () => setAppShortcutPaths(loadAppShortcutPaths())
    refresh()
    window.addEventListener(APP_SHORTCUTS_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(APP_SHORTCUTS_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const desktopShortcutEntries = useMemo(() => {
    const hasTrashItems = filesystem
      .listDir('/home/Trash')
      .some((entry) => entry.type === 'file' || entry.type === 'dir')

    return getDesktopApps(installedAppIds)
      .filter((app) => {
        const shortcutPath = getAppShortcutPath(app.id, appShortcutPaths)
        const safePath = filesystem.isDir(shortcutPath) ? shortcutPath : '/home/Desktop'
        if (safePath !== currentPath) return false
        if (currentPath === '/home/Desktop') {
          return app.id !== 'computer' && app.id !== 'trash'
        }
        return true
      })
      .map((app) => ({
        type: 'shortcut',
        path: `shortcut:${app.id}`,
        name: app.title,
        appId: app.id,
        Icon: app.Icon ?? null,
        iconClass:
          app.id === 'trash' && hasTrashItems ? 'trash-full' : app.iconClass
      }))
  }, [appShortcutPaths, currentPath, filesystem, installedAppIds])

  const navigateTo = (path) => {
    if (!path) return
    setNavState((prev) => {
      if (prev.stack[prev.index] === path) return prev
      const nextStack = prev.stack.slice(0, prev.index + 1)
      nextStack.push(path)
      return { stack: nextStack, index: nextStack.length - 1 }
    })
  }

  const goBack = () => {
    setNavState((prev) => {
      if (prev.index === 0) return prev
      return { ...prev, index: prev.index - 1 }
    })
  }

  const filesystemEntries = useMemo(() => {
    const list = filesystem.listDir(currentPath)
    return list.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [filesystem, currentPath])

  const entries = useMemo(
    () => [...desktopShortcutEntries, ...filesystemEntries],
    [desktopShortcutEntries, filesystemEntries]
  )

  useEffect(() => {
    if (!watchPath || typeof onWatchPathMissing !== 'function') return
    const exists = filesystem.pathExists(watchPath)
    if (exists) {
      missingNotifiedRef.current = false
      return
    }
    if (missingNotifiedRef.current) return
    missingNotifiedRef.current = true
    onWatchPathMissing(watchPath)
  }, [filesystem, onWatchPathMissing, watchPath])

  const handleOpen = (entry) => {
    if (entry.type === 'shortcut') {
      openWindow?.(entry.appId)
      return
    }
    if (entry.type === 'dir') {
      navigateTo(entry.path)
      return
    }
    openFileEntry(entry, { filesystem, openWindow })
  }

  const createFolderInCurrentPath = () => {
    if (!filesystem.isDir(currentPath)) return false
    const baseName = 'New Folder'
    let attempt = 0
    while (attempt < 100) {
      const folderName = attempt === 0 ? baseName : `${baseName} (${attempt})`
      const folderPath = filesystem.joinPath(currentPath, folderName)
      if (!filesystem.pathExists(folderPath)) {
        filesystem.createDir(folderPath)
        return true
      }
      attempt += 1
    }
    filesystem.createDir(
      filesystem.joinPath(currentPath, `${baseName} ${Date.now()}`)
    )
    return true
  }

  const handleShellContextMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const isInMain = event.target.closest('.explorer-list')
    const isOnItem = event.target.closest('.explorer-item')
    if (!isInMain || isOnItem) {
      closeMenu()
      return
    }
    const items = [
      {
        label: 'Open Settings',
        onSelect: () => openWindow?.('settings')
      },
      {
        label: 'New Folder',
        onSelect: createFolderInCurrentPath
      }
    ]

    if (currentPath === '/home/Trash') {
      const trashEntries = entries.filter(
        (entry) => entry.type === 'file' || entry.type === 'dir'
      )
      items.push({
        label: 'Empty Trash',
        disabled: trashEntries.length === 0,
        onSelect: () => {
          if (!trashEntries.length) return
          ui?.openConfirm?.({
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
      })
    }

    openContextMenu({
      event,
      width: 180,
      items
    })
  }

  const handleEntryContextMenu = (event, entry) => {
    if (!entry || (entry.type !== 'file' && entry.type !== 'dir')) return
    const requestRenameFolder = () => {
      if (entry.type !== 'dir' || typeof window === 'undefined') return false
      const proposedName = window.prompt('Rename folder', entry.name ?? 'New Folder')
      if (proposedName === null) return false
      const nextName = proposedName.trim()
      if (!nextName || nextName === entry.name) return false
      return renameEntry(entry, nextName, { filesystem })
    }
    openContextMenu({
      event,
      width: 180,
      items: entry.path?.startsWith('/home/Trash')
        ? [
            {
              label: 'Restore',
              onSelect: () => restoreEntry(entry, { filesystem })
            },
            {
              label: 'Delete Permanently',
              onSelect: () => {
                ui?.openConfirm?.({
                  title: 'Delete Permanently',
                  message:
                    'This will permanently delete the item. This action cannot be undone.',
                  confirmLabel: 'Delete permanently',
                  cancelLabel: 'Cancel',
                  tone: 'danger',
                  onConfirm: () => trashEntry(entry, { filesystem })
                })
              }
            }
          ]
        : entry.type === 'dir'
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

  const places = [
    { id: 'home', label: 'Home', path: '/home' },
    { id: 'desktop', label: 'Desktop', path: '/home/Desktop' },
    { id: 'trash', label: 'Trash', path: '/home/Trash' },
    { id: 'mnt', label: 'Mounts', path: '/mnt' }
  ]

  return (
    <div className="explorer-shell" onContextMenu={handleShellContextMenu}>
      <aside className="explorer-sidebar">
        <div className="explorer-sidebar-title">Places</div>
        <div className="explorer-sidebar-list">
          {places.map((place) => {
            const isActive = currentPath === place.path
            return (
              <button
                key={place.id}
                type="button"
                className={`explorer-place ${isActive ? 'is-active' : ''}`.trim()}
                onClick={() => navigateTo(place.path)}
              >
                <span className="explorer-place-dot" aria-hidden="true" />
                <span>{place.label}</span>
              </button>
            )
          })}
        </div>
      </aside>
      <section className="explorer-main">
        <div className="explorer-toolbar">
          <button
            className="explorer-back"
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label="Back"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M12.5 4.5L7 10l5.5 5.5" />
            </svg>
          </button>
          <div className="explorer-path">{currentPath}</div>
        </div>
        <div className="explorer-list-header">
          <span>Name</span>
        </div>
        <div className="explorer-list">
          {entries.length === 0 ? (
            <div className="explorer-empty">This folder is empty.</div>
          ) : (
            entries.map((entry) => {
              if (entry.type === 'shortcut') {
                const ShortcutIcon = entry.Icon
                const iconClass = entry.iconClass ?? 'file'
                return (
                  <button
                    key={entry.path}
                    type="button"
                    className="explorer-item"
                    onClick={() => handleOpen(entry)}
                  >
                    <span className={`explorer-icon ${iconClass}`.trim()} aria-hidden="true">
                      {ShortcutIcon ? (
                        <ShortcutIcon />
                      ) : (
                        <svg viewBox="0 0 64 64" aria-hidden="true">
                          <path d="M18 8h20l12 12v32a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
                          <path d="M38 8v12h12" />
                          <rect x="22" y="30" width="20" height="4" rx="2" />
                          <rect x="22" y="40" width="16" height="4" rx="2" />
                        </svg>
                      )}
                    </span>
                    <span className="explorer-name">{entry.name}</span>
                  </button>
                )
              }
              if (entry.type === 'dir') {
                return (
                  <button
                    key={entry.path}
                    type="button"
                    className="explorer-item"
                    onClick={() => handleOpen(entry)}
                    onContextMenu={(event) => handleEntryContextMenu(event, entry)}
                  >
                    <span className="explorer-icon folder" aria-hidden="true">
                      <FolderIcon />
                    </span>
                    <span className="explorer-name">{entry.name}</span>
                  </button>
                )
              }
              const association = getFileAssociation(entry.name)
              const appDefinition = association?.appId
                ? getAppDefinition(association.appId)
                : null
              const FileIcon = appDefinition?.Icon
              const iconClass = appDefinition?.iconClass ?? 'file'
              return (
                <button
                  key={entry.path}
                  type="button"
                  className="explorer-item"
                  onClick={() => handleOpen(entry)}
                  onContextMenu={(event) => handleEntryContextMenu(event, entry)}
                >
                  <span
                    className={`explorer-icon ${iconClass}`.trim()}
                    aria-hidden="true"
                  >
                    {FileIcon ? (
                      <FileIcon />
                    ) : (
                      <svg viewBox="0 0 64 64" aria-hidden="true">
                        <path d="M18 8h20l12 12v32a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
                        <path d="M38 8v12h12" />
                        <rect x="22" y="30" width="20" height="4" rx="2" />
                        <rect x="22" y="40" width="16" height="4" rx="2" />
                      </svg>
                    )}
                  </span>
                  <span className="explorer-name">{entry.name}</span>
                </button>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
