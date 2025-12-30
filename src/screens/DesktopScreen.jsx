import { useEffect, useRef, useState } from 'react'
import { getAppDefinition, getContextMenuApps } from '../apps/registry'
import { ContextMenuProvider, useContextMenu } from '../components/ContextMenuProvider'
import { DesktopIconLayer } from '../components/DesktopIconLayer'
import { Taskbar } from '../components/Taskbar'
import { DesktopWindow } from '../components/DesktopWindow'
import { useDesktopItems } from '../hooks/useDesktopItems'
import { useWindowManager } from '../hooks/useWindowManager'
import { trashFileEntry } from '../state/fileActions'
import { useFilesystem } from '../state/filesystemContext'
import { useResolution } from '../state/resolutionContext'
import '../styles/desktop.css'

const WINDOW_CLOSE_DURATION = 220

function DesktopSurface({ viewportRef }) {
  const { openContextMenu, closeMenu } = useContextMenu()
  const [closingIds, setClosingIds] = useState(() => new Set())
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
    if (!contextMenuApps.length) return
    openContextMenu({
      event,
      items: contextMenuApps.map((app) => ({
        label: `Open ${app.title}`,
        onSelect: () => openWindow(app.id)
      }))
    })
  }

  const handleFileContextMenu = (event, entry) => {
    if (!entry || entry.type !== 'file') return
    openContextMenu({
      event,
      width: 160,
      height: 48,
      items: [
        {
          label: 'Delete',
          onSelect: () => trashFileEntry(entry, { filesystem })
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
    >
      <DesktopIconLayer
        viewportRef={viewportRef}
        items={iconItems}
        onOpenApp={openWindow}
        onOpenFile={openFile}
        onFileContextMenu={handleFileContextMenu}
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
