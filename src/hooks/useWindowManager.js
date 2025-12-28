import { useEffect, useRef, useState } from 'react'
import { getAppDefinition } from '../apps/registry'

const TASKBAR_HEIGHT = 48
const MIN_WIDTH = 320
const MIN_HEIGHT = 220
const FALLBACK_WINDOW = {
  width: 520,
  height: 360,
  x: 220,
  y: 110
}

const getWindowDefaults = (appDefinition) => {
  const template = appDefinition?.window ?? {}
  return {
    width: template.width ?? FALLBACK_WINDOW.width,
    height: template.height ?? FALLBACK_WINDOW.height,
    x: template.x ?? FALLBACK_WINDOW.x,
    y: template.y ?? FALLBACK_WINDOW.y
  }
}

const getWindowContent = (appDefinition) => {
  const content = appDefinition?.window?.content
  if (content === undefined) return null
  if (content && typeof content === 'object') {
    if (typeof structuredClone === 'function') {
      return structuredClone(content)
    }
    if (Array.isArray(content)) {
      return [...content]
    }
    return { ...content }
  }
  return content
}

export function useWindowManager(viewportRef) {
  const [windows, setWindows] = useState([])
  const [draggingWindow, setDraggingWindow] = useState(null)
  const [resizingWindow, setResizingWindow] = useState(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const windowIdRef = useRef(1)
  const windowZRef = useRef(20)

  const clampRect = (rect, bounds) => {
    const availableHeight = Math.max(bounds.height - TASKBAR_HEIGHT, 0)
    const widthLimit = Math.max(bounds.width, 0)
    const heightLimit = Math.max(availableHeight, 0)
    const nextWidth =
      widthLimit >= MIN_WIDTH
        ? Math.min(Math.max(rect.width, MIN_WIDTH), widthLimit)
        : Math.min(rect.width, widthLimit)
    const nextHeight =
      heightLimit >= MIN_HEIGHT
        ? Math.min(Math.max(rect.height, MIN_HEIGHT), heightLimit)
        : Math.min(rect.height, heightLimit)
    const maxX = Math.max(widthLimit - nextWidth, 0)
    const maxY = Math.max(heightLimit - nextHeight, 0)
    const nextX = Math.min(Math.max(rect.x, 0), maxX)
    const nextY = Math.min(Math.max(rect.y, 0), maxY)
    return { x: nextX, y: nextY, width: nextWidth, height: nextHeight }
  }

  const openWindow = (type, overrides = {}) => {
    const appDefinition = getAppDefinition(type)
    if (!appDefinition) return
    const defaults = getWindowDefaults(appDefinition)
    const content = getWindowContent(appDefinition)
    const maxInstances = appDefinition.maxInstances ?? 1
    const zIndex = ++windowZRef.current
    setWindows((prev) => {
      const existingOfType = prev.filter((window) => window.type === type)
      if (existingOfType.length >= maxInstances) {
        const topWindow = existingOfType.reduce((best, current) =>
          current.zIndex > best.zIndex ? current : best
        )
        return prev.map((window) =>
          window.id === topWindow.id
            ? { ...window, isMinimized: false, zIndex }
            : window
        )
      }
      const id = windowIdRef.current++
      const offset = (prev.length * 24) % 120
      const bounds =
        viewportSize.width && viewportSize.height
          ? viewportSize
          : { width: defaults.width, height: defaults.height + TASKBAR_HEIGHT }
      const rect = clampRect(
        {
          x: defaults.x + offset,
          y: defaults.y + offset,
          width: defaults.width,
          height: defaults.height
        },
        bounds
      )
      return [
        ...prev,
        {
          id,
          type,
          title: appDefinition.title ?? type,
          ...rect,
          isMinimized: false,
          isMaximized: false,
          zIndex,
          normal: null,
          content: overrides.content ?? content,
          filename: overrides.filename ?? appDefinition.window?.filename ?? null,
          path: overrides.path ?? appDefinition.window?.path ?? null
        }
      ]
    })
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
    setWindows((prev) =>
      prev.map((window) => {
        const nextNormal = window.normal
          ? clampRect(window.normal, viewportSize)
          : null
        if (window.isMaximized) {
          return nextNormal ? { ...window, normal: nextNormal } : window
        }
        const clamped = clampRect(window, viewportSize)
        return {
          ...window,
          ...clamped,
          normal: nextNormal
        }
      })
    )
  }, [viewportSize])

  const bringToFront = (id) => {
    const zIndex = ++windowZRef.current
    setWindows((prev) =>
      prev.map((window) =>
        window.id === id ? { ...window, zIndex } : window
      )
    )
  }

  const closeWindow = (id) => {
    setWindows((prev) => prev.filter((window) => window.id !== id))
  }

  const toggleMinimize = (id) => {
    setWindows((prev) =>
      prev.map((window) =>
        window.id === id
          ? { ...window, isMinimized: !window.isMinimized }
          : window
      )
    )
  }

  const toggleMaximize = (id) => {
    setWindows((prev) =>
      prev.map((window) => {
        if (window.id !== id) return window
        if (window.isMaximized) {
          const defaults = getWindowDefaults(getAppDefinition(window.type))
          const normal = window.normal || defaults
          return {
            ...window,
            isMaximized: false,
            x: normal.x,
            y: normal.y,
            width: normal.width,
            height: normal.height,
            normal: null
          }
        }
        return {
          ...window,
          isMaximized: true,
          isMinimized: false,
          normal: {
            x: window.x,
            y: window.y,
            width: window.width,
            height: window.height
          }
        }
      })
    )
  }

  const updateWindow = (id, updates) => {
    setWindows((prev) =>
      prev.map((window) => {
        if (window.id !== id) return window
        const nextUpdates =
          typeof updates === 'function' ? updates(window) : updates
        return { ...window, ...nextUpdates }
      })
    )
  }

  const startDrag = (event, windowData) => {
    bringToFront(windowData.id)
    if (windowData.isMaximized) return
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    setDraggingWindow({
      id: windowData.id,
      offsetX: event.clientX - rect.left - windowData.x,
      offsetY: event.clientY - rect.top - windowData.y
    })
  }

  const startResize = (event, windowData) => {
    bringToFront(windowData.id)
    if (windowData.isMaximized) return
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    setResizingWindow({
      id: windowData.id,
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      startWidth: windowData.width,
      startHeight: windowData.height,
      originX: windowData.x,
      originY: windowData.y
    })
  }

  useEffect(() => {
    if (!draggingWindow) return

    const handleMouseMove = (event) => {
      const viewport = viewportRef.current
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()

      setWindows((prev) =>
        prev.map((window) => {
          if (window.id !== draggingWindow.id) return window
          const maxX = rect.width - window.width
          const maxY = rect.height - window.height - TASKBAR_HEIGHT
          const nextX = Math.min(
            Math.max(event.clientX - rect.left - draggingWindow.offsetX, 0),
            Math.max(maxX, 0)
          )
          const nextY = Math.min(
            Math.max(event.clientY - rect.top - draggingWindow.offsetY, 0),
            Math.max(maxY, 0)
          )
          return { ...window, x: nextX, y: nextY }
        })
      )
    }

    const handleMouseUp = () => {
      setDraggingWindow(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingWindow, viewportRef])

  useEffect(() => {
    if (!resizingWindow) return

    const handleMouseMove = (event) => {
      const viewport = viewportRef.current
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()
      setWindows((prev) =>
        prev.map((window) => {
          if (window.id !== resizingWindow.id) return window
          const maxWidth = rect.width - resizingWindow.originX
          const maxHeight =
            rect.height - TASKBAR_HEIGHT - resizingWindow.originY
          const deltaX = event.clientX - rect.left - resizingWindow.startX
          const deltaY = event.clientY - rect.top - resizingWindow.startY
          const nextWidth = Math.min(
            Math.max(resizingWindow.startWidth + deltaX, MIN_WIDTH),
            Math.max(maxWidth, MIN_WIDTH)
          )
          const nextHeight = Math.min(
            Math.max(resizingWindow.startHeight + deltaY, MIN_HEIGHT),
            Math.max(maxHeight, MIN_HEIGHT)
          )
          return {
            ...window,
            width: nextWidth,
            height: nextHeight
          }
        })
      )
    }

    const handleMouseUp = () => {
      setResizingWindow(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingWindow, viewportRef])

  return {
    windows,
    openWindow,
    bringToFront,
    closeWindow,
    toggleMinimize,
    toggleMaximize,
    startDrag,
    startResize,
    updateWindow
  }
}
