import { useMemo, useState } from 'react'
import { getAppDefinition } from '../apps/registry'
import { openFileEntry, restoreFileEntry, trashFileEntry } from '../state/fileActions'
import { getFileAssociation } from '../state/fileAssociations'
import { useContextMenu } from './ContextMenuProvider'
import '../styles/file-explorer.css'

const FolderIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 20a4 4 0 0 1 4-4h14l6 6h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z" />
    <path d="M8 24h48v8H8z" />
  </svg>
)

export function FileExplorer({ filesystem, openWindow, ui, startPath = '/' }) {
  const { openContextMenu, closeMenu } = useContextMenu()
  const [navState, setNavState] = useState(() => ({
    stack: [startPath],
    index: 0
  }))

  const currentPath = navState.stack[navState.index] ?? '/'
  const canGoBack = navState.index > 0

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

  const entries = useMemo(() => {
    const list = filesystem.listDir(currentPath)
    return list.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [filesystem, currentPath])

  const handleOpen = (entry) => {
    if (entry.type === 'dir') {
      navigateTo(entry.path)
      return
    }
    openFileEntry(entry, { filesystem, openWindow })
  }

  const handleShellContextMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const isInMain = event.target.closest('.explorer-list')
    const isOnItem = event.target.closest('.explorer-item')
    if (!isInMain || isOnItem || currentPath !== '/home/Trash') {
      closeMenu()
      return
    }
    const trashFiles =
      currentPath === '/home/Trash'
        ? entries.filter((entry) => entry.type === 'file')
        : []
    openContextMenu({
      event,
      width: 180,
      height: 44,
      items: [
        {
          label: 'Empty Trash',
          disabled: trashFiles.length === 0,
          onSelect: () => {
            if (!trashFiles.length) return
            ui?.openConfirm?.({
              title: 'Empty Trash',
              message:
                'This will permanently delete all files in Trash. This action cannot be undone.',
              confirmLabel: 'Delete all',
              cancelLabel: 'Cancel',
              tone: 'danger',
              onConfirm: () => {
                trashFiles.forEach((file) => filesystem.deleteFile(file.path))
              }
            })
          }
        }
      ]
    })
  }

  const handleFileContextMenu = (event, entry) => {
    if (!entry || entry.type !== 'file') return
    openContextMenu({
      event,
      width: 180,
      items: entry.path?.startsWith('/home/Trash')
        ? [
            {
              label: 'Restore',
              onSelect: () => restoreFileEntry(entry, { filesystem })
            },
            {
              label: 'Delete Permanently',
              onSelect: () => {
                ui?.openConfirm?.({
                  title: 'Delete Permanently',
                  message:
                    'This will permanently delete the file. This action cannot be undone.',
                  confirmLabel: 'Delete permanently',
                  cancelLabel: 'Cancel',
                  tone: 'danger',
                  onConfirm: () => trashFileEntry(entry, { filesystem })
                })
              }
            }
          ]
        : [
            {
              label: 'Delete',
              onSelect: () => trashFileEntry(entry, { filesystem })
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
              if (entry.type === 'dir') {
                return (
                  <button
                    key={entry.path}
                    type="button"
                    className="explorer-item"
                    onClick={() => handleOpen(entry)}
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
                  onContextMenu={(event) => handleFileContextMenu(event, entry)}
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
