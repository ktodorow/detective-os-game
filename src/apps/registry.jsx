import { useState } from 'react'
import { FileDialog } from '../components/FileDialog'
import { RESOLUTION_MODES } from '../state/resolutionContext'

const EmptyState = () => <div className="window-empty">No content yet.</div>

const ComputerIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="8" y="10" width="48" height="32" rx="3" />
    <rect x="14" y="16" width="36" height="20" rx="2" />
    <rect x="26" y="44" width="12" height="4" rx="1" />
    <rect x="20" y="48" width="24" height="4" rx="1" />
  </svg>
)

const FolderIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 20a4 4 0 0 1 4-4h14l6 6h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z" />
    <path d="M8 24h48v8H8z" />
  </svg>
)

const SettingsIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="10" />
    <path d="M32 6l4 8 9 2-6 7 1 9-8-4-8 4 1-9-6-7 9-2z" />
  </svg>
)

const NotepadIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="14" y="10" width="36" height="44" rx="4" />
    <rect x="20" y="18" width="24" height="4" rx="2" />
    <rect x="20" y="28" width="24" height="4" rx="2" />
    <rect x="20" y="38" width="16" height="4" rx="2" />
  </svg>
)

const SettingsWindow = ({ resolution }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleFactoryReset = () => {
    if (typeof window === 'undefined') return
    setShowResetConfirm(false)
    setIsResetting(true)
    setTimeout(() => {
      window.localStorage.clear()
      window.location.reload()
    }, 3500)
  }

  return (
    <div className="settings-panel">
      <div className="settings-title">Display</div>
      <div className="settings-group">
        <div className="settings-label">Resolution</div>
        <label className="settings-option">
          <input
            type="radio"
            name="resolution"
            checked={resolution.mode === RESOLUTION_MODES.DEFAULT}
            onChange={() => resolution.setMode(RESOLUTION_MODES.DEFAULT)}
          />
          <span>Default (1200 × 800)</span>
        </label>
        <label className="settings-option">
          <input
            type="radio"
            name="resolution"
            checked={resolution.mode === RESOLUTION_MODES.FULLSCREEN}
            onChange={() => resolution.setMode(RESOLUTION_MODES.FULLSCREEN)}
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
              resolution.setMode(RESOLUTION_MODES.FULLSCREEN)
              resolution.toggleSystemFullscreen()
            }}
            disabled={!resolution.canFullscreen}
          >
            {resolution.isSystemFullscreen
              ? 'Exit Fullscreen'
              : 'Enter Fullscreen'}
          </button>
          <span className="settings-note">
            {resolution.canFullscreen
              ? 'Removes browser UI for true fullscreen.'
              : 'Fullscreen is not available in this browser.'}
          </span>
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-label">Data</div>
        <div className="settings-row">
          <button
            className="settings-button settings-danger"
            type="button"
            onClick={() => setShowResetConfirm(true)}
          >
            Factory Reset
          </button>
          <span className="settings-note">
            Deletes all saved files and settings.
          </span>
        </div>
      </div>
      {showResetConfirm ? (
        <div className="settings-reset-overlay">
          <div className="settings-reset-card" role="dialog" aria-modal="true">
            <div className="settings-reset-title">Factory Reset</div>
            <div className="settings-reset-text">
              This will permanently delete all game data, files, and settings
              from this device. There is no undo.
            </div>
            <div className="settings-reset-actions">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
              >
                No, cancel
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={handleFactoryReset}
              >
                Yes, delete everything
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isResetting ? (
        <div className="settings-reset-overlay">
          <div className="settings-reset-card settings-reset-loading">
            <div className="settings-reset-title">
              Deleting and cleaning up data...
            </div>
            <div className="settings-reset-spinner" aria-hidden="true" />
            <div className="settings-reset-text">
              Please wait. This will take a moment.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const renderSettings = (_window, { resolution }) => (
  <SettingsWindow resolution={resolution} />
)

const getDirectoryPath = (path) => {
  if (!path) return '/home/Desktop'
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return '/'
  return `/${parts.slice(0, -1).join('/')}`
}

const getBasename = (path) => {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? 'Untitled.txt'
}

const ensureTxtExtension = (name) => {
  const trimmed = name.trim()
  if (!trimmed) return 'Untitled.txt'
  const lower = trimmed.toLowerCase()
  if (lower.endsWith('.txt')) return trimmed
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex > 0) {
    return `${trimmed.slice(0, dotIndex)}.txt`
  }
  return `${trimmed}.txt`
}

const NotepadWindow = ({ appWindow, actions, filesystem }) => {
  const content = appWindow.content ?? ''
  const filename = appWindow.filename ?? 'Untitled.txt'
  const filePath = appWindow.path
  const [dialog, setDialog] = useState(null)

  const handleOpen = () => {
    setDialog({
      mode: 'open',
      directory: getDirectoryPath(filePath) || '/home/Desktop',
      filename
    })
  }

  const handleSave = () => {
    if (
      filePath &&
      filesystem.pathExists(filePath) &&
      filePath.toLowerCase().endsWith('.txt')
    ) {
      const nextName = ensureTxtExtension(filename)
      filesystem.writeFile(filePath, content)
      actions.updateWindow(appWindow.id, { filename: nextName, path: filePath })
      return
    }
    setDialog({
      mode: 'save',
      directory: getDirectoryPath(filePath) || '/home/Desktop',
      filename: ensureTxtExtension(filename)
    })
  }

  const handleSaveAs = () => {
    setDialog({
      mode: 'save',
      directory: getDirectoryPath(filePath) || '/home/Desktop',
      filename: ensureTxtExtension(filename)
    })
  }

  const handleDialogConfirm = (path) => {
    if (!path) return
    if (dialog?.mode === 'open') {
      const nextContent = filesystem.readFile(path)
      if (nextContent === null) return
      actions.updateWindow(appWindow.id, {
        content: nextContent,
        filename: getBasename(path),
        path
      })
    } else {
      const nextName = ensureTxtExtension(getBasename(path))
      const nextPath = filesystem.joinPath(getDirectoryPath(path), nextName)
      filesystem.writeFile(nextPath, content)
      actions.updateWindow(appWindow.id, {
        filename: nextName,
        path: nextPath
      })
    }
    setDialog(null)
  }

  return (
    <div className="notepad-shell">
      <div className="notepad-toolbar">
        <button type="button" onClick={handleOpen}>
          Open
        </button>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={handleSaveAs}>
          Save as
        </button>
      </div>
      <textarea
        className="notepad-textarea"
        value={content}
        onChange={(event) =>
          actions.updateWindow(appWindow.id, { content: event.target.value })
        }
        placeholder="Start typing..."
      />
      {dialog ? (
        <FileDialog
          mode={dialog.mode}
          filesystem={filesystem}
          initialDirectory={dialog.directory}
          initialFilename={dialog.filename}
          normalizeFilename={ensureTxtExtension}
          filterEntry={(entry) =>
            entry.type === 'dir' ||
            entry.name.toLowerCase().endsWith('.txt')
          }
          onConfirm={handleDialogConfirm}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}

const renderNotepad = (appWindow, { actions, filesystem }) => (
  <NotepadWindow
    appWindow={appWindow}
    actions={actions}
    filesystem={filesystem}
  />
)

export const APP_LIST = [
  {
    id: 'computer',
    title: 'My Computer',
    iconClass: 'computer',
    Icon: ComputerIcon,
    showOnDesktop: true,
    showInContextMenu: false,
    taskbarLabel: 'PC',
    maxInstances: 1,
    window: { width: 520, height: 360, x: 220, y: 110 },
    render: () => <EmptyState />
  },
  {
    id: 'folder',
    title: 'Case Files',
    iconClass: 'folder',
    Icon: FolderIcon,
    showOnDesktop: true,
    showInContextMenu: false,
    taskbarLabel: 'CF',
    maxInstances: 1,
    window: { width: 520, height: 360, x: 260, y: 140 },
    render: () => <EmptyState />
  },
  {
    id: 'notepad',
    title: 'Notepad',
    iconClass: 'notepad',
    Icon: NotepadIcon,
    showOnDesktop: true,
    showInContextMenu: false,
    taskbarLabel: 'NP',
    maxInstances: 5,
    window: {
      width: 640,
      height: 420,
      x: 240,
      y: 140,
      content: '',
      filename: 'Untitled.txt',
      path: null
    },
    render: renderNotepad
  },
  {
    id: 'settings',
    title: 'Settings',
    iconClass: 'settings',
    Icon: SettingsIcon,
    showOnDesktop: false,
    showInContextMenu: true,
    taskbarLabel: 'ST',
    maxInstances: 1,
    window: { width: 460, height: 320, x: 280, y: 160 },
    render: renderSettings
  }
]

export const APP_BY_ID = APP_LIST.reduce((acc, app) => {
  acc[app.id] = app
  return acc
}, {})

export const getAppDefinition = (id) => APP_BY_ID[id]

export const getDesktopApps = () => APP_LIST.filter((app) => app.showOnDesktop)

export const getContextMenuApps = () =>
  APP_LIST.filter((app) => app.showInContextMenu)
