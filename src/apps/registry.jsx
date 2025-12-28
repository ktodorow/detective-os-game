import { useRef } from 'react'
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

const renderSettings = (_window, { resolution }) => (
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
      <div className="settings-note">Fill mode uses the current browser size.</div>
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
          {resolution.isSystemFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        </button>
        <span className="settings-note">
          {resolution.canFullscreen
            ? 'Removes browser UI for true fullscreen.'
            : 'Fullscreen is not available in this browser.'}
        </span>
      </div>
    </div>
  </div>
)

const downloadText = (filename, text) => {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const NotepadWindow = ({ appWindow, actions }) => {
  const inputRef = useRef(null)
  const content = appWindow.content ?? ''
  const filename = appWindow.filename ?? 'Untitled.txt'

  const handleOpen = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      actions.updateWindow(appWindow.id, {
        content: typeof reader.result === 'string' ? reader.result : '',
        filename: file.name
      })
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const handleSave = () => {
    downloadText(filename, content)
  }

  const handleSaveAs = () => {
    const nextName = window.prompt('Save as', filename)
    if (!nextName) return
    actions.updateWindow(appWindow.id, { filename: nextName })
    downloadText(nextName, content)
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
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileChange}
          className="notepad-file-input"
          aria-hidden="true"
          tabIndex={-1}
        />
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

const renderNotepad = (appWindow, { actions }) => (
  <NotepadWindow appWindow={appWindow} actions={actions} />
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
      filename: 'Untitled.txt'
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
