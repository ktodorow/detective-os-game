const FILE_ASSOCIATIONS = [
  {
    extension: '.txt',
    appId: 'notepad',
    label: 'Text Document'
  }
]

const getExtension = (name) => {
  if (!name) return ''
  const match = name.toLowerCase().match(/(\.[^.]+)$/)
  return match ? match[1] : ''
}

export const getFileAssociation = (name) => {
  const extension = getExtension(name)
  if (!extension) return null
  return FILE_ASSOCIATIONS.find((assoc) => assoc.extension === extension) ?? null
}

export const getFileExtension = getExtension
