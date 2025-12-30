import { ConfirmDialog } from '../components/ConfirmDialog'
import { FileDialog } from '../components/FileDialog'
import { FileExplorer } from '../components/FileExplorer'
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

const SettingsWindow = ({ resolution, ui }) => {
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
            onClick={() =>
              ui?.openConfirm?.({
                title: 'Factory Reset',
                message:
                  'This will permanently delete all game data, files, and settings from this device. There is no undo.',
                confirmLabel: 'Yes, delete everything',
                cancelLabel: 'No, cancel',
                tone: 'danger',
                onConfirm: ui?.startFactoryReset
              })
            }
          >
            Factory Reset
          </button>
          <span className="settings-note">
            Deletes all saved files and settings.
          </span>
        </div>
      </div>
    </div>
  )
}

const renderSettings = (_window, { resolution, ui }) => (
  <SettingsWindow resolution={resolution} ui={ui} />
)

const renderComputer = (_window, { filesystem, actions }) => (
  <FileExplorer
    filesystem={filesystem}
    openWindow={actions.openWindow}
    startPath="/"
  />
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

const NotepadWindow = ({ appWindow, actions, filesystem, ui }) => {
  const content = appWindow.content ?? ''
  const filename = appWindow.filename ?? 'Untitled.txt'
  const filePath = appWindow.path

  const openFileDialog = (mode) => {
    ui?.openFileDialog?.({
      mode,
      initialDirectory: getDirectoryPath(filePath) || '/home/Desktop',
      initialFilename: ensureTxtExtension(filename),
      normalizeFilename: ensureTxtExtension,
      filterEntry: (entry) =>
        entry.type === 'dir' ||
        entry.name.toLowerCase().endsWith('.txt'),
      onConfirm: (path) => {
        if (!path) return false
        if (mode === 'open') {
          const nextContent = filesystem.readFile(path)
          if (nextContent === null) return false
          actions.updateWindow(appWindow.id, {
            content: nextContent,
            filename: getBasename(path),
            path
          })
          return true
        }
        const nextName = ensureTxtExtension(getBasename(path))
        const nextPath = filesystem.joinPath(getDirectoryPath(path), nextName)
        filesystem.writeFile(nextPath, content)
        actions.updateWindow(appWindow.id, {
          filename: nextName,
          path: nextPath
        })
        return true
      }
    })
  }

  const handleOpen = () => {
    openFileDialog('open')
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
    openFileDialog('save')
  }

  const handleSaveAs = () => {
    openFileDialog('save')
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
    </div>
  )
}

const renderNotepad = (appWindow, { actions, filesystem, ui }) => (
  <NotepadWindow
    appWindow={appWindow}
    actions={actions}
    filesystem={filesystem}
    ui={ui}
  />
)

const renderFileDialog = (appWindow, { filesystem, actions }) => {
  const payload = appWindow.payload ?? {}
  const handleConfirm = (path) => {
    const result = payload.onConfirm?.(path)
    if (result === false) return false
    actions.closeWindow(appWindow.id)
    return true
  }

  return (
    <FileDialog
      embedded
      mode={payload.mode ?? 'open'}
      filesystem={filesystem}
      initialDirectory={payload.initialDirectory}
      initialFilename={payload.initialFilename}
      normalizeFilename={payload.normalizeFilename}
      filterEntry={payload.filterEntry}
      onConfirm={handleConfirm}
      onCancel={() => actions.closeWindow(appWindow.id)}
      title={payload.title ?? appWindow.title}
    />
  )
}

const renderConfirmDialog = (appWindow, { actions }) => {
  const payload = appWindow.payload ?? {}
  const handleConfirm = () => {
    payload.onConfirm?.()
    actions.closeWindow(appWindow.id)
  }

  return (
    <ConfirmDialog
      title={payload.title ?? appWindow.title}
      message={payload.message}
      confirmLabel={payload.confirmLabel}
      cancelLabel={payload.cancelLabel}
      tone={payload.tone}
      onConfirm={handleConfirm}
      onCancel={() => actions.closeWindow(appWindow.id)}
    />
  )
}

const renderResetProgress = () => (
  <div className="reset-progress">
    <div className="reset-progress-title">Deleting and cleaning up data...</div>
    <div className="reset-progress-spinner" aria-hidden="true" />
    <div className="reset-progress-text">
      Please wait. This will take a moment.
    </div>
  </div>
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
    render: renderComputer
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
  },
  {
    id: 'fileDialog',
    title: 'File Dialog',
    iconClass: null,
    Icon: null,
    showOnDesktop: false,
    showInContextMenu: false,
    taskbarLabel: 'DLG',
    maxInstances: 5,
    window: { width: 540, height: 420, x: 260, y: 140 },
    render: renderFileDialog
  },
  {
    id: 'confirmDialog',
    title: 'Confirm',
    iconClass: null,
    Icon: null,
    showOnDesktop: false,
    showInContextMenu: false,
    taskbarLabel: 'DLG',
    maxInstances: 5,
    window: { width: 420, height: 220, x: 300, y: 180 },
    render: renderConfirmDialog
  },
  {
    id: 'resetProgress',
    title: 'Resetting',
    iconClass: null,
    Icon: null,
    showOnDesktop: false,
    showInContextMenu: false,
    taskbarLabel: 'SYS',
    maxInstances: 1,
    window: { width: 380, height: 200, x: 320, y: 200 },
    render: renderResetProgress
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
