import { useEffect, useRef, useState } from 'react'
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
  const desktopApps = getDesktopApps()
  const contextMenuApps = getContextMenuApps()
  const desktopFiles = filesystem
    .listDir('/home/Desktop')
    .filter(
      (entry) =>
        entry.type === 'file' && entry.name.toLowerCase().endsWith('.txt')
    )
    .sort((a, b) => a.name.localeCompare(b.name))

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
          {desktopApps.map((app) => {
            const Icon = app.Icon
            return (
              <DesktopIcon
                key={app.id}
                label={app.title}
                onClick={() => openWindow(app.id)}
              >
                <span
                  className={`icon-graphic ${app.iconClass ?? ''}`.trim()}
                  aria-hidden="true"
                >
                  {Icon ? <Icon /> : null}
                </span>
              </DesktopIcon>
            )
          })}
          {desktopFiles.map((entry) => (
            <DesktopIcon
              key={entry.path}
              label={entry.name}
              onClick={() => handleOpenFile(entry)}
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
          ))}
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
