import { useEffect, useRef, useState } from 'react'
import {
  getAppDefinition,
  getContextMenuApps,
  getDesktopApps
} from '../apps/registry'
import { DesktopIcon } from '../components/DesktopIcon'
import { DesktopWindow } from '../components/DesktopWindow'
import { useWindowManager } from '../hooks/useWindowManager'
import { useResolution } from '../state/resolutionContext'
import '../styles/desktop.css'

export function DesktopScreen() {
  const viewportRef = useRef(null)
  const [contextMenu, setContextMenu] = useState(null)
  const resolution = useResolution()
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
      actions: { updateWindow }
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
