import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const STORAGE_KEY = 'detective-os.fs.v1'
const FilesystemContext = createContext(null)

const createDefaultFilesystem = () => ({
  version: 1,
  nodes: {
    '/': { type: 'dir', name: '', children: ['home', 'mnt'] },
    '/home': { type: 'dir', name: 'home', children: ['Desktop'] },
    '/home/Desktop': { type: 'dir', name: 'Desktop', children: [] },
    '/mnt': { type: 'dir', name: 'mnt', children: [] }
  }
})

const normalizePath = (path) => {
  if (!path) return '/'
  const normalized = `/${path}`.replace(/\/+/g, '/')
  if (normalized !== '/' && normalized.endsWith('/')) {
    return normalized.slice(0, -1)
  }
  return normalized
}

const getParentPath = (path) => {
  if (path === '/') return null
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return '/'
  return `/${parts.slice(0, -1).join('/')}`
}

const getBasename = (path) => {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

const filesystemReducer = (state, action) => {
  switch (action.type) {
    case 'CREATE_DIR': {
      const path = normalizePath(action.path)
      if (state.nodes[path]) return state
      const parentPath = getParentPath(path)
      if (!parentPath) return state
      const parent = state.nodes[parentPath]
      if (!parent || parent.type !== 'dir') return state
      const name = getBasename(path)
      const nextParentChildren = parent.children.includes(name)
        ? parent.children
        : [...parent.children, name]
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [parentPath]: { ...parent, children: nextParentChildren },
          [path]: { type: 'dir', name, children: [] }
        }
      }
    }
    case 'WRITE_FILE': {
      const path = normalizePath(action.path)
      const parentPath = getParentPath(path)
      if (!parentPath) return state
      const parent = state.nodes[parentPath]
      if (!parent || parent.type !== 'dir') return state
      const name = getBasename(path)
      const isNew = !state.nodes[path]
      const nextParentChildren = isNew
        ? parent.children.includes(name)
          ? parent.children
          : [...parent.children, name]
        : parent.children
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [parentPath]: { ...parent, children: nextParentChildren },
          [path]: {
            type: 'file',
            name,
            content: action.content ?? ''
          }
        }
      }
    }
    default:
      return state
  }
}

const isValidFilesystem = (data) =>
  data &&
  typeof data === 'object' &&
  data.nodes &&
  data.nodes['/'] &&
  data.nodes['/'].type === 'dir'

const initFilesystem = () => {
  if (typeof window === 'undefined') {
    return createDefaultFilesystem()
  }
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return createDefaultFilesystem()
  try {
    const parsed = JSON.parse(stored)
    return isValidFilesystem(parsed) ? parsed : createDefaultFilesystem()
  } catch {
    return createDefaultFilesystem()
  }
}

export function FilesystemProvider({ children }) {
  const [state, dispatch] = useReducer(filesystemReducer, null, initFilesystem)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo(() => {
    const getNode = (path) => state.nodes[normalizePath(path)] ?? null
    const listDir = (path) => {
      const normalized = normalizePath(path)
      const node = state.nodes[normalized]
      if (!node || node.type !== 'dir') return []
      return node.children
        .map((name) => {
          const childPath =
            normalized === '/' ? `/${name}` : `${normalized}/${name}`
          const child = state.nodes[childPath]
          return child ? { path: childPath, ...child } : null
        })
        .filter(Boolean)
    }
    const pathExists = (path) => Boolean(state.nodes[normalizePath(path)])
    const isDir = (path) =>
      state.nodes[normalizePath(path)]?.type === 'dir'
    const isFile = (path) =>
      state.nodes[normalizePath(path)]?.type === 'file'
    const joinPath = (base, name) => {
      const safeBase = normalizePath(base)
      const safeName = name?.replace(/^\/+/, '') ?? ''
      if (!safeName) return safeBase
      return safeBase === '/' ? `/${safeName}` : `${safeBase}/${safeName}`
    }
    const readFile = (path) => {
      const node = state.nodes[normalizePath(path)]
      if (!node || node.type !== 'file') return null
      return node.content ?? ''
    }
    const writeFile = (path, content) =>
      dispatch({ type: 'WRITE_FILE', path, content })
    const createDir = (path) => dispatch({ type: 'CREATE_DIR', path })

    return {
      getNode,
      listDir,
      pathExists,
      isDir,
      isFile,
      joinPath,
      readFile,
      writeFile,
      createDir
    }
  }, [state])

  return (
    <FilesystemContext.Provider value={value}>
      {children}
    </FilesystemContext.Provider>
  )
}

export function useFilesystem() {
  const context = useContext(FilesystemContext)
  if (!context) {
    throw new Error('useFilesystem must be used within FilesystemProvider')
  }
  return context
}
