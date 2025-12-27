import { useRef } from 'react'
import { DesktopIcon } from '../components/DesktopIcon'
import { DesktopWindow } from '../components/DesktopWindow'
import { useWindowManager } from '../hooks/useWindowManager'
import { RESOLUTION_MODES, useResolution } from '../state/resolutionContext'
import '../styles/desktop.css'

export function DesktopScreen() {
  const viewportRef = useRef(null)
  const {
    mode,
    setMode,
    canFullscreen,
    isSystemFullscreen,
    toggleSystemFullscreen
  } = useResolution()
  const {
    windows,
    openWindow,
    bringToFront,
    closeWindow,
    toggleMinimize,
    toggleMaximize,
    startDrag,
    startResize
  } = useWindowManager(viewportRef)

  const renderWindowContent = (appWindow) => {
    if (appWindow.type === 'settings') {
      return (
        <div className="settings-panel">
          <div className="settings-title">Display</div>
          <div className="settings-group">
            <div className="settings-label">Resolution</div>
            <label className="settings-option">
              <input
                type="radio"
                name="resolution"
                checked={mode === RESOLUTION_MODES.DEFAULT}
                onChange={() => setMode(RESOLUTION_MODES.DEFAULT)}
              />
              <span>Default (1200 × 800)</span>
            </label>
            <label className="settings-option">
              <input
                type="radio"
                name="resolution"
                checked={mode === RESOLUTION_MODES.FULLSCREEN}
                onChange={() => setMode(RESOLUTION_MODES.FULLSCREEN)}
              />
              <span>Browser (Fill screen)</span>
            </label>
            <div className="settings-note">
              Fill mode uses the current browser size.
            </div>
          </div>
          <div className="settings-group">
            <div className="settings-label">Native Fullscreen</div>
            <div className="settings-row">
              <button
                className="settings-button"
                type="button"
                onClick={() => {
                  setMode(RESOLUTION_MODES.FULLSCREEN)
                  toggleSystemFullscreen()
                }}
                disabled={!canFullscreen}
              >
                {isSystemFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              </button>
              <span className="settings-note">
                {canFullscreen
                  ? 'Removes browser UI for true fullscreen.'
                  : 'Fullscreen is not available in this browser.'}
              </span>
            </div>
          </div>
        </div>
      )
    }

    return <div className="window-empty">No content yet.</div>
  }

  return (
    <main className="app">
      <div className="viewport desktop-screen" ref={viewportRef}>
        <div className="desktop-icons">
          <DesktopIcon label="My Computer" onClick={() => openWindow('computer')}>
            <span className="icon-graphic computer" aria-hidden="true">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <rect x="8" y="10" width="48" height="32" rx="3" />
                <rect x="14" y="16" width="36" height="20" rx="2" />
                <rect x="26" y="44" width="12" height="4" rx="1" />
                <rect x="20" y="48" width="24" height="4" rx="1" />
              </svg>
            </span>
          </DesktopIcon>
          <DesktopIcon label="Case Files" onClick={() => openWindow('folder')}>
            <span className="icon-graphic folder" aria-hidden="true">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <path d="M8 20a4 4 0 0 1 4-4h14l6 6h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z" />
                <path d="M8 24h48v8H8z" />
              </svg>
            </span>
          </DesktopIcon>
          <DesktopIcon label="Settings" onClick={() => openWindow('settings')}>
            <span className="icon-graphic settings" aria-hidden="true">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="10" />
                <path d="M32 6l4 8 9 2-6 7 1 9-8-4-8 4 1-9-6-7 9-2z" />
              </svg>
            </span>
          </DesktopIcon>
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
                  {appWindow.type === 'computer'
                    ? 'PC'
                    : appWindow.type === 'folder'
                      ? 'CF'
                      : appWindow.type === 'settings'
                        ? 'ST'
                        : 'APP'}
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
