import { useEffect, useMemo, useState } from 'react'
import { getAppDefinition, getDesktopApps } from '../apps/registry'
import { openFileEntry } from '../state/fileActions'
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
import { useFilesystem } from '../state/filesystemContext'

const sortItems = (items) =>
  [...items].sort((a, b) => a.label.localeCompare(b.label))

export function useDesktopItems({ openWindow }) {
  const filesystem = useFilesystem()
  const [installedAppIds, setInstalledAppIds] = useState(getInstalledAppIds)
  const [appShortcutPaths, setAppShortcutPaths] = useState(loadAppShortcutPaths)
  const desktopApps = getDesktopApps(installedAppIds)
  const desktopEntries = filesystem
    .listDir('/home/Desktop')
    .filter((entry) => entry.type === 'file' || entry.type === 'dir')
  const trashFiles = filesystem
    .listDir('/home/Trash')
    .filter((entry) => entry.type === 'file' || entry.type === 'dir')
  const hasTrashFiles = trashFiles.length > 0

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

  const items = useMemo(() => {
    const appItems = desktopApps
      .filter((app) => {
        const shortcutPath = getAppShortcutPath(app.id, appShortcutPaths)
        const safePath = filesystem.isDir(shortcutPath) ? shortcutPath : '/home/Desktop'
        return safePath === '/home/Desktop'
      })
      .map((app) => {
        const iconClass =
          app.id === 'trash'
            ? hasTrashFiles
              ? 'trash-full'
              : app.iconClass
            : app.iconClass
        return {
          id: `app:${app.id}`,
          type: 'app',
          app,
          label: app.title,
          iconClass
        }
      })

    const fileItems = desktopEntries.map((entry) => {
      if (entry.type === 'dir') {
        const folderApp = getAppDefinition('folder')
        return {
          id: `dir:${entry.path}`,
          type: 'entry',
          entry,
          label: entry.name,
          Icon: folderApp?.Icon ?? null,
          iconClass: 'folder'
        }
      }
      const association = getFileAssociation(entry.name)
      const appDefinition = association?.appId
        ? getAppDefinition(association.appId)
        : null
      return {
        id: `file:${entry.path}`,
        type: 'file',
        entry,
        label: entry.name,
        Icon: appDefinition?.Icon ?? null,
        iconClass: appDefinition?.iconClass ?? 'file'
      }
    })

    return sortItems([...appItems, ...fileItems])
  }, [appShortcutPaths, desktopApps, desktopEntries, filesystem, hasTrashFiles])

  const openFile = (entry) => {
    if (!entry) return false
    if (entry.type === 'dir') {
      openWindow('computer', {
        title: entry.name || 'Folder',
        payload: {
          startPath: entry.path,
          taskbarIconClass: 'folder'
        }
      })
      return true
    }
    return openFileEntry(entry, {
      filesystem,
      openWindow
    })
  }

  return { items, openFile }
}
