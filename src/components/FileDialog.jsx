import { useEffect, useMemo, useState } from 'react'

const getParentPath = (path) => {
  if (!path || path === '/') return null
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return '/'
  return `/${parts.slice(0, -1).join('/')}`
}

const sortEntries = (entries) =>
  [...entries].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'dir' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

export function FileDialog({
  mode,
  filesystem,
  initialDirectory = '/home/Desktop',
  initialFilename = '',
  normalizeFilename = (value) => value,
  filterEntry = null,
  onConfirm,
  onCancel,
  title
}) {
  const [currentDir, setCurrentDir] = useState(initialDirectory)
  const [selectedPath, setSelectedPath] = useState(null)
  const [filename, setFilename] = useState(initialFilename)
  const [showOverwrite, setShowOverwrite] = useState(false)

  useEffect(() => {
    setCurrentDir(initialDirectory)
    setSelectedPath(null)
    setFilename(initialFilename)
    setShowOverwrite(false)
  }, [initialDirectory, initialFilename, mode])

  const entries = useMemo(() => {
    if (!filesystem?.isDir(currentDir)) return []
    const listed = filesystem.listDir(currentDir)
    const filtered = filterEntry ? listed.filter(filterEntry) : listed
    return sortEntries(filtered)
  }, [currentDir, filesystem, filterEntry])

  const handleUp = () => {
    const parent = getParentPath(currentDir)
    if (!parent) return
    setCurrentDir(parent)
    setSelectedPath(null)
  }

  const handleEntryClick = (entry) => {
    if (entry.type === 'dir') {
      setCurrentDir(entry.path)
      setSelectedPath(null)
      return
    }
    setSelectedPath(entry.path)
    setFilename(entry.name)
  }

  const handleOpen = (entry) => {
    if (entry.type === 'dir') {
      setCurrentDir(entry.path)
      setSelectedPath(null)
      return
    }
    onConfirm?.(entry.path)
  }

  const handleSave = () => {
    const trimmed = filename.trim()
    if (!trimmed) return
    const normalizedName = normalizeFilename(trimmed)
    if (!normalizedName) return
    if (normalizedName !== trimmed) {
      setFilename(normalizedName)
    }
    const path = filesystem.joinPath(currentDir, normalizedName)
    if (filesystem.pathExists(path)) {
      setShowOverwrite(true)
      return
    }
    onConfirm?.(path)
  }

  const handleConfirmOverwrite = () => {
    const trimmed = filename.trim()
    if (!trimmed) return
    const normalizedName = normalizeFilename(trimmed)
    if (!normalizedName) return
    if (normalizedName !== trimmed) {
      setFilename(normalizedName)
    }
    const path = filesystem.joinPath(currentDir, normalizedName)
    onConfirm?.(path)
    setShowOverwrite(false)
  }

  const canOpen = mode === 'open' && selectedPath

  return (
    <div className="file-dialog-overlay" role="presentation">
      <div className="file-dialog-panel" role="dialog" aria-modal="true">
        <div className="file-dialog-header">
          <div className="file-dialog-title">
            {title ?? (mode === 'open' ? 'Open File' : 'Save File')}
          </div>
          <button type="button" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <div className="file-dialog-path">
          <button type="button" onClick={handleUp} disabled={currentDir === '/'}>
            Up
          </button>
          <span>{currentDir}</span>
        </div>
        <div className="file-dialog-list">
          {entries.length ? (
            entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={`file-dialog-item ${
                  selectedPath === entry.path ? 'is-selected' : ''
                }`}
                onClick={() => handleEntryClick(entry)}
                onDoubleClick={() => handleOpen(entry)}
              >
                <span className={`file-dialog-icon ${entry.type}`}>
                  {entry.type === 'dir' ? '📁' : '📄'}
                </span>
                <span className="file-dialog-name">{entry.name}</span>
              </button>
            ))
          ) : (
            <div className="file-dialog-empty">This folder is empty.</div>
          )}
        </div>
        {mode === 'save' ? (
          <div className="file-dialog-field">
            <label htmlFor="save-filename">File name</label>
            <input
              id="save-filename"
              type="text"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              placeholder="Untitled.txt"
            />
          </div>
        ) : null}
        <div className="file-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          {mode === 'open' ? (
            <button
              type="button"
              className="is-primary"
              onClick={() => onConfirm?.(selectedPath)}
              disabled={!canOpen}
            >
              Open
            </button>
          ) : (
            <button
              type="button"
              className="is-primary"
              onClick={handleSave}
            >
              Save
            </button>
          )}
        </div>
        {showOverwrite ? (
          <div className="file-dialog-confirm">
            <div className="file-dialog-confirm-card">
              <div className="file-dialog-confirm-title">
                Replace existing file?
              </div>
              <div className="file-dialog-confirm-text">
                A file with this name already exists. Do you want to replace it?
              </div>
              <div className="file-dialog-confirm-actions">
                <button type="button" onClick={() => setShowOverwrite(false)}>
                  No
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={handleConfirmOverwrite}
                >
                  Yes, replace
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
