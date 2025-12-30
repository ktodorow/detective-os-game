import { getFileAssociation } from './fileAssociations'

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
