import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const STORAGE_KEY = 'detective-os.fs.v1'
const FilesystemContext = createContext(null)

const createDefaultFilesystem = () => ({
  version: 1,
  nodes: {
    '/': { type: 'dir', name: '', children: ['home', 'mnt'] },
    '/home': { type: 'dir', name: 'home', children: ['Desktop', 'Trash'] },
    '/home/Desktop': { type: 'dir', name: 'Desktop', children: [] },
    '/home/Trash': { type: 'dir', name: 'Trash', children: [] },
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

const getSubtreePaths = (nodes, rootPath) =>
  Object.keys(nodes).filter(
    (nodePath) => nodePath === rootPath || nodePath.startsWith(`${rootPath}/`)
  )

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
    case 'DELETE_NODE': {
      const path = normalizePath(action.path)
      const node = state.nodes[path]
      if (!node || path === '/') return state
      const parentPath = getParentPath(path)
      if (!parentPath) return state
      const parent = state.nodes[parentPath]
      if (!parent || parent.type !== 'dir') return state
      const name = getBasename(path)
      const nextNodes = { ...state.nodes }
      const subtreePaths =
        node.type === 'dir' ? getSubtreePaths(state.nodes, path) : [path]
      subtreePaths.forEach((nodePath) => {
        delete nextNodes[nodePath]
      })
      nextNodes[parentPath] = {
        ...parent,
        children: parent.children.filter((child) => child !== name)
      }
      return {
        ...state,
        nodes: nextNodes
      }
    }
    case 'MOVE_NODE': {
      const from = normalizePath(action.from)
      const to = normalizePath(action.to)
      const updates = action.updates ?? null
      if (from === to) return state
      const node = state.nodes[from]
      if (!node || from === '/') return state
      if (node.type === 'dir' && to.startsWith(`${from}/`)) return state
      if (state.nodes[to]) return state
      const fromParentPath = getParentPath(from)
      const toParentPath = getParentPath(to)
      if (!fromParentPath || !toParentPath) return state
      const fromParent = state.nodes[fromParentPath]
      const toParent = state.nodes[toParentPath]
      if (!fromParent || fromParent.type !== 'dir') return state
      if (!toParent || toParent.type !== 'dir') return state
      const fromName = getBasename(from)
      const toName = getBasename(to)
      const nextFromChildren = fromParent.children.filter(
        (child) => child !== fromName
      )
      const nextToChildren = toParent.children.includes(toName)
        ? toParent.children
        : [...toParent.children, toName]
      const nextNodes = { ...state.nodes }
      const subtreePaths =
        node.type === 'dir' ? getSubtreePaths(state.nodes, from) : [from]
      const movedNodes = {}
      subtreePaths.forEach((oldPath) => {
        const oldNode = state.nodes[oldPath]
        if (!oldNode) return
        const newPath = oldPath === from ? to : `${to}${oldPath.slice(from.length)}`
        const isRoot = oldPath === from
        const movedNode = isRoot ? { ...oldNode, name: toName } : { ...oldNode }
        movedNodes[newPath] = movedNode
        delete nextNodes[oldPath]
      })
      const nextRootNode = updates
        ? { ...movedNodes[to], ...updates }
        : movedNodes[to]
      const nextNode = nextRootNode ?? (updates ? { ...node, ...updates } : node)
      if (updates?.originPath === null) {
        delete nextNode.originPath
      }
      if (updates?.trashedAt === null) {
        delete nextNode.trashedAt
      }
      Object.entries(movedNodes).forEach(([newPath, movedNode]) => {
        nextNodes[newPath] = movedNode
      })
      nextNodes[to] = nextNode
      nextNodes[fromParentPath] = {
        ...fromParent,
        children: nextFromChildren
      }
      nextNodes[toParentPath] = {
        ...toParent,
        children: nextToChildren
      }
      return {
        ...state,
        nodes: nextNodes
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

  useEffect(() => {
    if (!state?.nodes?.['/home/Trash']) {
      dispatch({ type: 'CREATE_DIR', path: '/home/Trash' })
    }
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
    const deleteFile = (path) => dispatch({ type: 'DELETE_NODE', path })
    const moveFile = (from, to, updates) =>
      dispatch({ type: 'MOVE_NODE', from, to, updates })

    return {
      getNode,
      listDir,
      pathExists,
      isDir,
      isFile,
      joinPath,
      readFile,
      writeFile,
      createDir,
      deleteFile,
      moveFile,
      deleteNode: deleteFile,
      moveNode: moveFile
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
