import { getFileAssociation } from './fileAssociations'

const TRASH_DIR = '/home/Trash'
const DEFAULT_RESTORE_DIR = '/home/Desktop'

const splitFilename = (name) => {
  const lastDot = name.lastIndexOf('.')
  if (lastDot > 0) {
    return { base: name.slice(0, lastDot), ext: name.slice(lastDot) }
  }
  return { base: name, ext: '' }
}

const buildUniquePath = (filesystem, directory, filename) => {
  const { base, ext } = splitFilename(filename)
  let attempt = 0
  let candidate = filename
  while (attempt < 100) {
    const path = filesystem.joinPath(directory, candidate)
    if (!filesystem.pathExists(path)) return path
    attempt += 1
    candidate = `${base} (${attempt})${ext}`
  }
  return filesystem.joinPath(directory, `${base} (${Date.now()})${ext}`)
}

const getDirectoryPath = (path) => {
  if (!path) return DEFAULT_RESTORE_DIR
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return '/'
  return `/${parts.slice(0, -1).join('/')}`
}

const getBasename = (path) => {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

export const openFileEntry = (entry, { filesystem, openWindow }) => {
  if (!entry || entry.type !== 'file') return false
  if (typeof openWindow !== 'function') return false
  const association = getFileAssociation(entry.name)
  if (!association?.appId) return false
  const content = filesystem.readFile(entry.path)
  if (content === null) return false
  openWindow(association.appId, {
    content,
    filename: entry.name,
    path: entry.path
  })
  return true
}

export const trashFileEntry = (entry, { filesystem }) => {
  if (!entry || entry.type !== 'file') return false
  if (!filesystem?.moveFile || !filesystem?.deleteFile) return false
  if (entry.path?.startsWith(TRASH_DIR)) {
    filesystem.deleteFile(entry.path)
    return true
  }
  const targetPath = buildUniquePath(filesystem, TRASH_DIR, entry.name)
  if (filesystem.pathExists(targetPath)) return false
  filesystem.moveFile(entry.path, targetPath, {
    originPath: entry.path,
    trashedAt: Date.now()
  })
  return true
}

export const restoreFileEntry = (entry, { filesystem }) => {
  if (!entry || entry.type !== 'file') return false
  if (!entry.path?.startsWith(TRASH_DIR)) return false
  if (!filesystem?.moveFile) return false
  const originalPath =
    entry.originPath ??
    filesystem.joinPath(DEFAULT_RESTORE_DIR, entry.name ?? 'Untitled')
  const originalDir = getDirectoryPath(originalPath)
  const targetDir = filesystem.isDir(originalDir)
    ? originalDir
    : DEFAULT_RESTORE_DIR
  const targetName = getBasename(originalPath) || entry.name
  const targetPath = buildUniquePath(filesystem, targetDir, targetName)
  filesystem.moveFile(entry.path, targetPath, {
    originPath: null,
    trashedAt: null
  })
  return true
}
