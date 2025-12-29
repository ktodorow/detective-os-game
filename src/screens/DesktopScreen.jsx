import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getAppDefinition,
  getContextMenuApps,
  getDesktopApps
} from '../apps/registry'
import { DesktopIcon } from '../components/DesktopIcon'
import { DesktopWindow } from '../components/DesktopWindow'
import { useWindowManager } from '../hooks/useWindowManager'
import { useFilesystem } from '../state/filesystemContext'
import { useResolution } from '../state/resolutionContext'
import '../styles/desktop.css'

export function DesktopScreen() {
  const viewportRef = useRef(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [iconPositions, setIconPositions] = useState({})
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [draggingId, setDraggingId] = useState(null)
  const draggingRef = useRef(null)
  const lastDragRef = useRef(null)
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

  const TASKBAR_HEIGHT = 48
  const ICON_WIDTH = 96
  const ICON_HEIGHT = 96
  const ICON_GAP = 20
  const ICON_PADDING_X = 32
  const ICON_PADDING_Y = 40
  const desktopApps = getDesktopApps()
  const contextMenuApps = getContextMenuApps()
  const desktopFiles = filesystem
    .listDir('/home/Desktop')
    .filter(
      (entry) =>
        entry.type === 'file' && entry.name.toLowerCase().endsWith('.txt')
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const iconItems = useMemo(() => {
    const appItems = desktopApps.map((app) => ({
      id: `app:${app.id}`,
      type: 'app',
      app,
      label: app.title
    }))
    const fileItems = desktopFiles.map((entry) => ({
      id: `file:${entry.path}`,
      type: 'file',
      entry,
      label: entry.name
    }))
    return [...appItems, ...fileItems]
  }, [desktopApps, desktopFiles])

  const getDefaultPosition = (index) => {
    const availableHeight = Math.max(
      viewportSize.height - TASKBAR_HEIGHT - ICON_PADDING_Y,
      ICON_HEIGHT
    )
    const maxRows = Math.max(
      Math.floor(availableHeight / (ICON_HEIGHT + ICON_GAP)),
      1
    )
    const row = index % maxRows
    const column = Math.floor(index / maxRows)
    return {
      x: ICON_PADDING_X + column * (ICON_WIDTH + ICON_GAP),
      y: ICON_PADDING_Y + row * (ICON_HEIGHT + ICON_GAP)
    }
  }

  const clampPosition = (position) => {
    const maxX = Math.max(viewportSize.width - ICON_WIDTH, 0)
    const maxY = Math.max(
      viewportSize.height - TASKBAR_HEIGHT - ICON_HEIGHT,
      0
    )
    return {
      x: Math.min(Math.max(position.x, 0), maxX),
      y: Math.min(Math.max(position.y, 0), maxY)
    }
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setViewportSize({ width, height })
    })
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!viewportSize.width || !viewportSize.height) return
    setIconPositions((prev) => {
      const next = { ...prev }
      let changed = false
      const idSet = new Set(iconItems.map((item) => item.id))

      iconItems.forEach((item, index) => {
        if (!next[item.id]) {
          next[item.id] = clampPosition(getDefaultPosition(index))
          changed = true
        }
      })

      Object.keys(next).forEach((key) => {
        if (!idSet.has(key)) {
          delete next[key]
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [iconItems, viewportSize])

  useEffect(() => {
    if (!viewportSize.width || !viewportSize.height) return
    setIconPositions((prev) => {
      const next = {}
      let changed = false
      Object.entries(prev).forEach(([key, position]) => {
        const clamped = clampPosition(position)
        next[key] = clamped
        if (clamped.x !== position.x || clamped.y !== position.y) {
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [viewportSize])

  useEffect(() => {
    if (!draggingRef.current) return

    const handleMouseMove = (event) => {
      const viewport = viewportRef.current
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()
      const current = draggingRef.current
      const nextX = event.clientX - rect.left - current.offsetX
      const nextY = event.clientY - rect.top - current.offsetY
      if (
        !current.moved &&
        (Math.abs(nextX - current.startX) > 3 ||
          Math.abs(nextY - current.startY) > 3)
      ) {
        current.moved = true
      }
      const clamped = clampPosition({ x: nextX, y: nextY })
      setIconPositions((prev) => ({
        ...prev,
        [current.id]: clamped
      }))
    }

    const handleMouseUp = () => {
      const current = draggingRef.current
      if (current?.moved) {
        lastDragRef.current = { id: current.id, time: Date.now() }
      }
      draggingRef.current = null
      setDraggingId(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingId, viewportSize])

  const handleIconMouseDown = (event, id) => {
    if (event.button !== 0) return
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const position = iconPositions[id] ?? { x: 0, y: 0 }
    draggingRef.current = {
      id,
      offsetX: event.clientX - rect.left - position.x,
      offsetY: event.clientY - rect.top - position.y,
      startX: position.x,
      startY: position.y,
      moved: false
    }
    setDraggingId(id)
  }

  const handleIconClick = (id, action) => {
    const lastDrag = lastDragRef.current
    if (lastDrag && lastDrag.id === id && Date.now() - lastDrag.time < 200) {
      lastDragRef.current = null
      return
    }
    action()
  }

  const handleOpenFile = (entry) => {
    const fileContent = filesystem.readFile(entry.path)
    if (fileContent === null) return
    openWindow('notepad', {
      content: fileContent,
      filename: entry.name,
      path: entry.path
    })
  }

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

  const ui = {
    openFileDialog,
    openConfirm,
    startFactoryReset
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleContextMenu = (event) => {
    event.preventDefault()
    if (!contextMenuApps.length) return
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const menuWidth = 200
    const menuHeight = contextMenuApps.length * 38 + 16
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const clampedX = Math.min(Math.max(x, 0), rect.width - menuWidth)
    const clampedY = Math.min(Math.max(y, 0), rect.height - menuHeight)
    setContextMenu({ x: clampedX, y: clampedY })
  }

  const handleMenuAction = (action) => {
    action()
    setContextMenu(null)
  }

  const renderWindowContent = (appWindow) => {
    const appDefinition = getAppDefinition(appWindow.type)
    if (!appDefinition?.render) {
      return <div className="window-empty">No content yet.</div>
    }
    return appDefinition.render(appWindow, {
      resolution,
      filesystem,
      actions: { updateWindow, closeWindow },
      ui
    })
  }

  return (
    <main className="app">
      <div
        className="viewport desktop-screen"
        ref={viewportRef}
        onContextMenu={handleContextMenu}
        onMouseDown={() => setContextMenu(null)}
      >
        <div className="desktop-icons">
          {iconItems.map((item, index) => {
            const position =
              iconPositions[item.id] ?? getDefaultPosition(index)
            const style = { top: position.y, left: position.x }
            if (item.type === 'app') {
              const Icon = item.app.Icon
              return (
                <DesktopIcon
                  key={item.id}
                  label={item.label}
                  style={style}
                  className={draggingId === item.id ? 'is-dragging' : ''}
                  onMouseDown={(event) => handleIconMouseDown(event, item.id)}
                  onClick={() =>
                    handleIconClick(item.id, () => openWindow(item.app.id))
                  }
                >
                  <span
                    className={`icon-graphic ${item.app.iconClass ?? ''}`.trim()}
                    aria-hidden="true"
                  >
                    {Icon ? <Icon /> : null}
                  </span>
                </DesktopIcon>
              )
            }
            return (
              <DesktopIcon
                key={item.id}
                label={item.label}
                style={style}
                className={draggingId === item.id ? 'is-dragging' : ''}
                onMouseDown={(event) => handleIconMouseDown(event, item.id)}
                onClick={() =>
                  handleIconClick(item.id, () => handleOpenFile(item.entry))
                }
              >
                <span className="icon-graphic file" aria-hidden="true">
                  <svg viewBox="0 0 64 64" aria-hidden="true">
                    <path d="M18 8h20l12 12v32a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
                    <path d="M38 8v12h12" />
                    <rect x="22" y="30" width="20" height="4" rx="2" />
                    <rect x="22" y="40" width="16" height="4" rx="2" />
                  </svg>
                </span>
              </DesktopIcon>
            )
          })}
        </div>
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
                onFocus={() => bringToFront(appWindow.id)}
                onDragStart={(event) => startDrag(event, appWindow)}
                onResizeStart={(event) => startResize(event, appWindow)}
                onMinimize={() => toggleMinimize(appWindow.id)}
                onMaximize={() => toggleMaximize(appWindow.id)}
                onClose={() => closeWindow(appWindow.id)}
              >
                {renderWindowContent(appWindow)}
              </DesktopWindow>
            )
          })}
        {contextMenu ? (
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {contextMenuApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => handleMenuAction(() => openWindow(app.id))}
              >
                Open {app.title}
              </button>
            ))}
          </div>
        ) : null}
        <div className="taskbar">
          <button className="start-button" type="button" aria-label="Start">
            <img src="/detective-face.svg" alt="" aria-hidden="true" />
          </button>
          <div className="taskbar-windows">
            {windows.map((appWindow) => (
              <button
                key={appWindow.id}
                className={`taskbar-window ${
                  appWindow.isMinimized ? 'is-minimized' : 'is-active'
                }`}
                type="button"
                onClick={() => {
                  toggleMinimize(appWindow.id)
                  bringToFront(appWindow.id)
                }}
              >
                <span className="taskbar-window-icon">
                  {getAppDefinition(appWindow.type)?.taskbarLabel ?? 'APP'}
                </span>
                <span className="taskbar-window-label">{appWindow.title}</span>
              </button>
            ))}
          </div>
          <div className="taskbar-icons" aria-hidden="true">
            <div className="taskbar-icon app-green">NB</div>
            <div className="taskbar-icon app-slate">DM</div>
          </div>
        </div>
      </div>
    </main>
  )
}
