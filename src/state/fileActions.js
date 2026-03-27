import { getFileAssociation } from './fileAssociations'

const TRASH_DIR = '/home/Trash'
const DEFAULT_RESTORE_DIR = '/home/Desktop'
const PROTECTED_DIRECTORIES = new Set([
  '/',
  '/home',
  '/home/Desktop',
  '/home/Trash',
  '/mnt'
])

const splitFilename = (name, isFile = true) => {
  if (!isFile) {
    return { base: name, ext: '' }
  }
  const lastDot = name.lastIndexOf('.')
  if (lastDot > 0) {
    return { base: name.slice(0, lastDot), ext: name.slice(lastDot) }
  }
  return { base: name, ext: '' }
}

const buildUniquePath = (filesystem, directory, filename, isFile = true) => {
  const { base, ext } = splitFilename(filename, isFile)
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

const normalizeEntryName = (name) => {
  if (typeof name !== 'string') return ''
  const trimmed = name.trim()
  if (!trimmed) return ''
  if (trimmed.includes('/')) return ''
  return trimmed
}

const isProtectedDirectory = (entry) =>
  entry?.type === 'dir' && PROTECTED_DIRECTORIES.has(entry.path)

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

export const trashEntry = (entry, { filesystem }) => {
  if (!entry || (entry.type !== 'file' && entry.type !== 'dir')) return false
  if (isProtectedDirectory(entry)) return false
  if (!filesystem?.moveFile || !filesystem?.deleteFile) return false
  if (entry.path?.startsWith(TRASH_DIR)) {
    filesystem.deleteFile(entry.path)
    return true
  }
  const targetPath = buildUniquePath(
    filesystem,
    TRASH_DIR,
    entry.name,
    entry.type === 'file'
  )
  if (filesystem.pathExists(targetPath)) return false
  filesystem.moveFile(entry.path, targetPath, {
    originPath: entry.path,
    trashedAt: Date.now()
  })
  return true
}

export const restoreEntry = (entry, { filesystem }) => {
  if (!entry || (entry.type !== 'file' && entry.type !== 'dir')) return false
  if (!entry.path?.startsWith(TRASH_DIR)) return false
  if (!filesystem?.moveFile) return false
  if (isProtectedDirectory(entry)) return false
  const originalPath =
    entry.originPath ??
    filesystem.joinPath(DEFAULT_RESTORE_DIR, entry.name ?? 'Untitled')
  const originalDir = getDirectoryPath(originalPath)
  const targetDir = filesystem.isDir(originalDir)
    ? originalDir
    : DEFAULT_RESTORE_DIR
  const targetName = getBasename(originalPath) || entry.name
  const targetPath = buildUniquePath(
    filesystem,
    targetDir,
    targetName,
    entry.type === 'file'
  )
  filesystem.moveFile(entry.path, targetPath, {
    originPath: null,
    trashedAt: null
  })
  return true
}

export const moveEntryToDirectory = (entry, targetDirPath, { filesystem }) => {
  if (!entry || (entry.type !== 'file' && entry.type !== 'dir')) return false
  if (!targetDirPath || typeof targetDirPath !== 'string') return false
  if (isProtectedDirectory(entry)) return false
  if (!filesystem?.isDir || !filesystem?.moveNode) return false
  if (!filesystem.isDir(targetDirPath)) return false

  const sourcePath = entry.path
  if (!sourcePath || sourcePath === targetDirPath) return false
  if (entry.type === 'dir' && targetDirPath.startsWith(`${sourcePath}/`)) {
    return false
  }

  const sourceParentPath = getDirectoryPath(sourcePath)
  if (sourceParentPath === targetDirPath) return false

  const targetPath = buildUniquePath(
    filesystem,
    targetDirPath,
    entry.name,
    entry.type === 'file'
  )
  if (targetPath === sourcePath) return false
  filesystem.moveNode(sourcePath, targetPath)
  return true
}

export const renameEntry = (entry, nextName, { filesystem }) => {
  if (!entry || (entry.type !== 'file' && entry.type !== 'dir')) return false
  if (isProtectedDirectory(entry)) return false
  if (!filesystem?.moveNode || !filesystem?.joinPath || !filesystem?.pathExists) {
    return false
  }

  const normalizedName = normalizeEntryName(nextName)
  if (!normalizedName) return false

  const sourcePath = entry.path
  if (!sourcePath) return false
  const parentPath = getDirectoryPath(sourcePath)
  const targetPath = filesystem.joinPath(parentPath, normalizedName)

  if (targetPath === sourcePath) return true
  if (filesystem.pathExists(targetPath)) return false

  filesystem.moveNode(sourcePath, targetPath)
  return true
}

export const trashFileEntry = trashEntry
export const restoreFileEntry = restoreEntry
