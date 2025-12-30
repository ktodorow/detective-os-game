import { useEffect, useMemo, useRef, useState } from 'react'
import { getAppDefinition } from '../apps/registry'
import { openFileEntry, restoreFileEntry, trashFileEntry } from '../state/fileActions'
import { getFileAssociation } from '../state/fileAssociations'
import '../styles/file-explorer.css'

const FolderIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 20a4 4 0 0 1 4-4h14l6 6h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z" />
    <path d="M8 24h48v8H8z" />
  </svg>
)

export function FileExplorer({ filesystem, openWindow, ui, startPath = '/' }) {
  const shellRef = useRef(null)
  const [navState, setNavState] = useState(() => ({
    stack: [startPath],
    index: 0
  }))
  const [contextMenu, setContextMenu] = useState(null)

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
    const shell = shellRef.current
    if (!shell) return
    const isInMain = event.target.closest('.explorer-list')
    const isOnItem = event.target.closest('.explorer-item')
    if (!isInMain || isOnItem || currentPath !== '/home/Trash') {
      setContextMenu(null)
      return
    }
    const rect = shell.getBoundingClientRect()
    const menuWidth = 180
    const menuHeight = 44
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const clampedX = Math.min(Math.max(x, 0), rect.width - menuWidth)
    const clampedY = Math.min(Math.max(y, 0), rect.height - menuHeight)
    setContextMenu({
      type: 'trash-root',
      x: clampedX,
      y: clampedY
    })
  }

  const handleFileContextMenu = (event, entry) => {
    event.preventDefault()
    event.stopPropagation()
    if (!entry || entry.type !== 'file') {
      setContextMenu(null)
      return
    }
    const shell = shellRef.current
    if (!shell) return
    const rect = shell.getBoundingClientRect()
    const menuWidth = 160
    const menuHeight = 44
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const clampedX = Math.min(Math.max(x, 0), rect.width - menuWidth)
    const clampedY = Math.min(Math.max(y, 0), rect.height - menuHeight)
    setContextMenu({
      type: 'file',
      x: clampedX,
      y: clampedY,
      entry
    })
  }

  useEffect(() => {
    if (!contextMenu) return
    const handlePointerDown = (event) => {
      const shell = shellRef.current
      if (shell && shell.contains(event.target)) {
        const menu = shell.querySelector('.explorer-context-menu')
        if (menu && menu.contains(event.target)) return
      }
      setContextMenu(null)
    }
    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [contextMenu])

  const places = [
    { id: 'home', label: 'Home', path: '/home' },
    { id: 'desktop', label: 'Desktop', path: '/home/Desktop' },
    { id: 'trash', label: 'Trash', path: '/home/Trash' },
    { id: 'mnt', label: 'Mounts', path: '/mnt' }
  ]
  const trashFiles =
    currentPath === '/home/Trash'
      ? entries.filter((entry) => entry.type === 'file')
      : []

  return (
    <div
      className="explorer-shell"
      ref={shellRef}
      onContextMenu={handleShellContextMenu}
    >
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
      {contextMenu ? (
        <div
          className="explorer-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {contextMenu.type === 'trash-root' ? (
            <button
              type="button"
              disabled={trashFiles.length === 0}
              onClick={() => {
                setContextMenu(null)
                if (!trashFiles.length) return
                ui?.openConfirm?.({
                  title: 'Empty Trash',
                  message:
                    'This will permanently delete all files in Trash. This action cannot be undone.',
                  confirmLabel: 'Delete all',
                  cancelLabel: 'Cancel',
                  tone: 'danger',
                  onConfirm: () => {
                    trashFiles.forEach((file) =>
                      filesystem.deleteFile(file.path)
                    )
                  }
                })
              }}
            >
              Empty Trash
            </button>
          ) : contextMenu.entry?.path?.startsWith('/home/Trash') ? (
            <>
              <button
                type="button"
                onClick={() => {
                  restoreFileEntry(contextMenu.entry, { filesystem })
                  setContextMenu(null)
                }}
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => {
                  const entry = contextMenu.entry
                  setContextMenu(null)
                  ui?.openConfirm?.({
                    title: 'Delete Permanently',
                    message:
                      'This will permanently delete the file. This action cannot be undone.',
                    confirmLabel: 'Delete permanently',
                    cancelLabel: 'Cancel',
                    tone: 'danger',
                    onConfirm: () => trashFileEntry(entry, { filesystem })
                  })
                }}
              >
                Delete Permanently
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                trashFileEntry(contextMenu.entry, { filesystem })
                setContextMenu(null)
              }}
            >
              Delete
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
