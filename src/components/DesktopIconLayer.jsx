import { useEffect, useRef, useState } from 'react'
import { DesktopIcon } from './DesktopIcon'

const TASKBAR_HEIGHT = 48
const ICON_WIDTH = 96
const ICON_HEIGHT = 112
const ICON_GAP = 24
const ICON_PADDING_X = 32
const ICON_PADDING_Y = 40

export function DesktopIconLayer({ viewportRef, items, onOpenApp, onOpenFile }) {
  const [iconPositions, setIconPositions] = useState({})
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [selectedIconId, setSelectedIconId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [draggingActiveId, setDraggingActiveId] = useState(null)
  const iconRefs = useRef(new Map())
  const draggingRef = useRef(null)
  const lastDragRef = useRef(null)
  const rafRef = useRef(0)
  const pendingPositionRef = useRef(null)
  const iconItems = items

  const getDefaultPosition = (index) => {
    const availableHeight = Math.max(
      viewportSize.height - TASKBAR_HEIGHT - ICON_PADDING_Y,
      ICON_HEIGHT
    )
    const maxRows = Math.max(
      Math.floor(availableHeight / (ICON_HEIGHT + ICON_GAP)),
      1
    )
    const row = index % maxRows
    const column = Math.floor(index / maxRows)
    return {
      x: ICON_PADDING_X + column * (ICON_WIDTH + ICON_GAP),
      y: ICON_PADDING_Y + row * (ICON_HEIGHT + ICON_GAP)
    }
  }

  const clampPosition = (position) => {
    const maxX = Math.max(viewportSize.width - ICON_WIDTH, 0)
    const maxY = Math.max(
      viewportSize.height - TASKBAR_HEIGHT - ICON_HEIGHT,
      0
    )
    return {
      x: Math.min(Math.max(position.x, 0), maxX),
      y: Math.min(Math.max(position.y, 0), maxY)
    }
  }

  const positionToCell = (position) => {
    const col = Math.round((position.x - ICON_PADDING_X) / (ICON_WIDTH + ICON_GAP))
    const row = Math.round((position.y - ICON_PADDING_Y) / (ICON_HEIGHT + ICON_GAP))
    return { col, row }
  }

  const cellToPosition = (cell) => ({
    x: ICON_PADDING_X + cell.col * (ICON_WIDTH + ICON_GAP),
    y: ICON_PADDING_Y + cell.row * (ICON_HEIGHT + ICON_GAP)
  })

  const clampCell = (cell, cols, rows) => ({
    col: Math.min(Math.max(cell.col, 0), Math.max(cols - 1, 0)),
    row: Math.min(Math.max(cell.row, 0), Math.max(rows - 1, 0))
  })

  const findOpenCell = (startCell, occupied, cols, rows) => {
    const maxRadius = Math.max(cols, rows)
    for (let radius = 0; radius <= maxRadius; radius += 1) {
      const rowStart = startCell.row - radius
      const rowEnd = startCell.row + radius
      const colStart = startCell.col - radius
      const colEnd = startCell.col + radius
      for (let row = rowStart; row <= rowEnd; row += 1) {
        for (let col = colStart; col <= colEnd; col += 1) {
          if (row < 0 || col < 0) continue
          if (row >= rows || col >= cols) continue
          const key = `${col}:${row}`
          if (!occupied.has(key)) {
            return { col, row }
          }
        }
      }
    }
    return clampCell(startCell, cols, rows)
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setViewportSize({ width, height })
    })
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [viewportRef])

  useEffect(() => {
    if (!viewportSize.width || !viewportSize.height) return
    const cols = Math.max(
      Math.floor(
        (viewportSize.width - ICON_PADDING_X * 2 + ICON_GAP) /
          (ICON_WIDTH + ICON_GAP)
      ),
      1
    )
    const rows = Math.max(
      Math.floor(
        (viewportSize.height -
          TASKBAR_HEIGHT -
          ICON_PADDING_Y * 2 +
          ICON_GAP) /
          (ICON_HEIGHT + ICON_GAP)
      ),
      1
    )
    setIconPositions((prev) => {
      const next = { ...prev }
      let changed = false
      const idSet = new Set(iconItems.map((item) => item.id))
      const occupied = new Set()

      Object.entries(next).forEach(([key, position]) => {
        if (!idSet.has(key)) return
        const cell = clampCell(positionToCell(position), cols, rows)
        const snapped = cellToPosition(cell)
        occupied.add(`${cell.col}:${cell.row}`)
        if (snapped.x !== position.x || snapped.y !== position.y) {
          next[key] = snapped
          changed = true
        }
      })

      iconItems.forEach((item, index) => {
        if (!next[item.id]) {
          const basePos = clampPosition(getDefaultPosition(index))
          const targetCell = clampCell(positionToCell(basePos), cols, rows)
          const openCell = findOpenCell(targetCell, occupied, cols, rows)
          next[item.id] = cellToPosition(openCell)
          occupied.add(`${openCell.col}:${openCell.row}`)
          changed = true
        }
      })

      Object.keys(next).forEach((key) => {
        if (!idSet.has(key)) {
          delete next[key]
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [iconItems, viewportSize])

  useEffect(() => {
    if (!draggingId) return
    const handleMouseMove = (event) => {
      const viewport = viewportRef.current
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()
      const current = draggingRef.current
      if (!current) return
      const nextX = event.clientX - rect.left - current.offsetX
      const nextY = event.clientY - rect.top - current.offsetY
      if (
        !current.moved &&
        (Math.abs(nextX - current.baseX) > 3 ||
          Math.abs(nextY - current.baseY) > 3)
      ) {
        current.moved = true
        setDraggingActiveId(current.id)
      }
      const clamped = clampPosition({ x: nextX, y: nextY })
      current.latestPosition = clamped
      pendingPositionRef.current = clamped
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = 0
          const pending = pendingPositionRef.current
          const active = draggingRef.current
          if (!pending || !active) return
          const node = iconRefs.current.get(active.id)
          if (!node) return
          const dx = pending.x - active.baseX
          const dy = pending.y - active.baseY
          node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
          node.style.willChange = 'transform'
        })
      }
    }

    const handleMouseUp = () => {
      const current = draggingRef.current
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      const pending = pendingPositionRef.current
      pendingPositionRef.current = null
      if (current && viewportSize.width && viewportSize.height) {
        const finalPosition = pending ?? current.latestPosition ?? {
          x: current.baseX,
          y: current.baseY
        }
        const cols = Math.max(
          Math.floor(
            (viewportSize.width - ICON_PADDING_X * 2 + ICON_GAP) /
              (ICON_WIDTH + ICON_GAP)
          ),
          1
        )
        const rows = Math.max(
          Math.floor(
            (viewportSize.height -
              TASKBAR_HEIGHT -
              ICON_PADDING_Y * 2 +
              ICON_GAP) /
              (ICON_HEIGHT + ICON_GAP)
          ),
          1
        )
        setIconPositions((prev) => {
          const occupied = new Set()
          Object.entries(prev).forEach(([key, position]) => {
            if (key === current.id) return
            const cell = clampCell(positionToCell(position), cols, rows)
            occupied.add(`${cell.col}:${cell.row}`)
          })
          const targetCell = clampCell(positionToCell(finalPosition), cols, rows)
          const openCell = findOpenCell(targetCell, occupied, cols, rows)
          return { ...prev, [current.id]: cellToPosition(openCell) }
        })
      }
      if (current) {
        const node = iconRefs.current.get(current.id)
        if (node) {
          node.style.transform = ''
          node.style.willChange = ''
        }
      }
      if (current?.moved) {
        lastDragRef.current = { id: current.id, time: Date.now() }
      }
      draggingRef.current = null
      setDraggingId(null)
      setDraggingActiveId(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingId, viewportRef, viewportSize])

  const handleIconMouseDown = (event, id) => {
    if (event.button !== 0) return
    event.preventDefault()
    setSelectedIconId(id)
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const position = iconPositions[id] ?? { x: 0, y: 0 }
    draggingRef.current = {
      id,
      offsetX: event.clientX - rect.left - position.x,
      offsetY: event.clientY - rect.top - position.y,
      baseX: position.x,
      baseY: position.y,
      moved: false
    }
    setDraggingId(id)
    setDraggingActiveId(null)
  }

  const handleIconDoubleClick = (id, action) => {
    const lastDrag = lastDragRef.current
    if (lastDrag && lastDrag.id === id && Date.now() - lastDrag.time < 250) {
      lastDragRef.current = null
      return
    }
    action()
  }

  const handleLayerMouseDown = (event) => {
    if (!event.target.closest('.desktop-icon')) {
      setSelectedIconId(null)
    }
  }

  return (
    <div className="desktop-icons" onMouseDown={handleLayerMouseDown}>
      {iconItems.map((item, index) => {
        const position = iconPositions[item.id] ?? getDefaultPosition(index)
        const style = { top: position.y, left: position.x }
        const isSelected = selectedIconId === item.id
        if (item.type === 'app') {
          const Icon = item.app.Icon
          return (
            <DesktopIcon
              key={item.id}
              label={item.label}
              ref={(node) => {
                if (node) {
                  iconRefs.current.set(item.id, node)
                } else {
                  iconRefs.current.delete(item.id)
                }
              }}
              style={style}
              className={`${isSelected ? 'is-selected' : ''} ${
                draggingActiveId === item.id ? 'is-dragging' : ''
              }`.trim()}
              onMouseDown={(event) => handleIconMouseDown(event, item.id)}
              onClick={() => setSelectedIconId(item.id)}
              onDoubleClick={() =>
                handleIconDoubleClick(item.id, () => onOpenApp(item.app.id))
              }
            >
              <span
                className={`icon-graphic ${item.app.iconClass ?? ''}`.trim()}
                aria-hidden="true"
              >
                {Icon ? <Icon /> : null}
              </span>
            </DesktopIcon>
          )
        }
        return (
          <DesktopIcon
            key={item.id}
            label={item.label}
            ref={(node) => {
              if (node) {
                iconRefs.current.set(item.id, node)
              } else {
                iconRefs.current.delete(item.id)
              }
            }}
            style={style}
            className={`${isSelected ? 'is-selected' : ''} ${
              draggingActiveId === item.id ? 'is-dragging' : ''
            }`.trim()}
            onMouseDown={(event) => handleIconMouseDown(event, item.id)}
            onClick={() => setSelectedIconId(item.id)}
            onDoubleClick={() =>
              handleIconDoubleClick(item.id, () => onOpenFile(item.entry))
            }
          >
            <span className="icon-graphic file" aria-hidden="true">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <path d="M18 8h20l12 12v32a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
                <path d="M38 8v12h12" />
                <rect x="22" y="30" width="20" height="4" rx="2" />
                <rect x="22" y="40" width="16" height="4" rx="2" />
              </svg>
            </span>
          </DesktopIcon>
        )
      })}
    </div>
  )
}
