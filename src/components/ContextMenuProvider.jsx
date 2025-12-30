import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ContextMenuContext = createContext(null)

export function ContextMenuProvider({ children, rootRef }) {
  const [menu, setMenu] = useState(null)
  const menuRef = useRef(null)

  const closeMenu = useCallback(() => {
    setMenu(null)
  }, [])

  const openContextMenu = useCallback(
    ({
      event,
      items,
      width = 200,
      height,
      rowHeight = 38,
      padding = 16,
      zIndex
    }) => {
      if (!items || items.length === 0) {
        closeMenu()
        return
      }
      if (event) {
        event.preventDefault()
        event.stopPropagation()
      }
      const root = rootRef?.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const x = event ? event.clientX - rect.left : 0
      const y = event ? event.clientY - rect.top : 0
      const menuHeight = height ?? items.length * rowHeight + padding
      const clampedX = Math.min(Math.max(x, 0), rect.width - width)
      const clampedY = Math.min(Math.max(y, 0), rect.height - menuHeight)
      const windowZ = event?.target?.closest?.('.desktop-window')?.style?.zIndex
      const computedZ = Number(windowZ)
      const nextZIndex =
        typeof zIndex === 'number'
          ? zIndex
          : Number.isFinite(computedZ) && computedZ > 0
            ? computedZ + 2
            : 1000
      setMenu({ x: clampedX, y: clampedY, items, width, zIndex: nextZIndex })
    },
    [closeMenu, rootRef]
  )

  const contextValue = useMemo(
    () => ({ openContextMenu, closeMenu }),
    [openContextMenu, closeMenu]
  )

  useEffect(() => {
    if (!menu) return
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return
      closeMenu()
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menu, closeMenu])

  const menuMarkup = menu ? (
    <div
      className="context-menu"
      style={{
        top: menu.y,
        left: menu.x,
        width: menu.width,
        zIndex: menu.zIndex
      }}
      ref={menuRef}
    >
      {menu.items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          type="button"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return
            const result = item.onSelect?.()
            if (result !== false) {
              closeMenu()
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null

  const portalRoot = rootRef?.current
  const menuNode = menuMarkup
    ? portalRoot
      ? createPortal(menuMarkup, portalRoot)
      : menuMarkup
    : null

  return (
    <ContextMenuContext.Provider value={contextValue}>
      {children}
      {menuNode}
    </ContextMenuContext.Provider>
  )
}

export function useContextMenu() {
  const context = useContext(ContextMenuContext)
  if (!context) {
    throw new Error('useContextMenu must be used within ContextMenuProvider')
  }
  return context
}
