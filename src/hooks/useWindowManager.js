import { useEffect, useRef, useState } from 'react'

const WINDOW_TEMPLATES = {
  computer: {
    title: 'My Computer',
    width: 520,
    height: 360,
    x: 220,
    y: 110
  }
}

const TASKBAR_HEIGHT = 48

export function useWindowManager(viewportRef) {
  const [windows, setWindows] = useState([])
  const [draggingWindow, setDraggingWindow] = useState(null)
  const windowIdRef = useRef(1)
  const windowZRef = useRef(20)

  const openWindow = (type) => {
    const template = WINDOW_TEMPLATES[type]
    if (!template) return
    const id = windowIdRef.current++
    const zIndex = ++windowZRef.current
    setWindows((prev) => {
      const offset = (prev.length * 24) % 120
      return [
        ...prev,
        {
          id,
          type,
          title: template.title,
          x: template.x + offset,
          y: template.y + offset,
          width: template.width,
          height: template.height,
          isMinimized: false,
          isMaximized: false,
          zIndex,
          normal: null
        }
      ]
    })
  }

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
          const normal = window.normal || {
            x: 220,
            y: 110,
            width: 520,
            height: 360
          }
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

  return {
    windows,
    openWindow,
    bringToFront,
    closeWindow,
    toggleMinimize,
    toggleMaximize,
    startDrag
  }
}
