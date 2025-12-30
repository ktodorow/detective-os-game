import { useMemo } from 'react'
import { getAppDefinition, getDesktopApps } from '../apps/registry'
import { openFileEntry } from '../state/fileActions'
import { getFileAssociation } from '../state/fileAssociations'
import { useFilesystem } from '../state/filesystemContext'

const sortItems = (items) =>
  [...items].sort((a, b) => a.label.localeCompare(b.label))

export function useDesktopItems({ openWindow }) {
  const filesystem = useFilesystem()
  const desktopApps = getDesktopApps()
  const desktopFiles = filesystem
    .listDir('/home/Desktop')
    .filter((entry) => entry.type === 'file')
  const trashFiles = filesystem
    .listDir('/home/Trash')
    .filter((entry) => entry.type === 'file')
  const hasTrashFiles = trashFiles.length > 0

  const items = useMemo(() => {
    const appItems = desktopApps.map((app) => {
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

    const fileItems = desktopFiles.map((entry) => {
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
  }, [desktopApps, desktopFiles, hasTrashFiles])

  const openFile = (entry) =>
    openFileEntry(entry, {
      filesystem,
      openWindow
    })

  return { items, openFile }
}
