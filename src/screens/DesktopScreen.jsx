import { useEffect, useRef, useState } from 'react'
import {
  getAppDefinition,
  getContextMenuApps,
} from '../apps/registry'
import { DesktopIconLayer } from '../components/DesktopIconLayer'
import { Taskbar } from '../components/Taskbar'
import { DesktopWindow } from '../components/DesktopWindow'
import { useDesktopItems } from '../hooks/useDesktopItems'
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

  const handleBackgroundMouseDown = () => {
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
      actions: { updateWindow, closeWindow, openWindow },
      ui
    })
  }

  return (
    <main className="app">
      <div
        className="viewport desktop-screen"
        ref={viewportRef}
        onContextMenu={handleContextMenu}
        onMouseDown={handleBackgroundMouseDown}
      >
        <DesktopIconLayer
          viewportRef={viewportRef}
          items={iconItems}
          onOpenApp={openWindow}
          onOpenFile={openFile}
        />
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
        <Taskbar
          windows={windows}
          onToggleMinimize={toggleMinimize}
          onBringToFront={bringToFront}
          panelRootRef={viewportRef}
        />
      </div>
    </main>
  )
}
