import { useMemo, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import { controlLayout } from './cockpitControls'
import { isMcduKey } from '../sim/useMcdu'

/** Project original model coordinates into a single, stable DOM interaction layer. */
export function ControlProjection({ targets, cameraMoving }: { targets: Map<string, HTMLButtonElement>; cameraMoving: RefObject<boolean> }) {
  const point = useMemo(() => new Vector3(), [])
  const eye = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    if (!(camera instanceof PerspectiveCamera)) return
    camera.updateMatrixWorld()
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360))
    for (const [name, button] of targets) {
      const layout = controlLayout[name]
      point.set(...layout.center)
      eye.copy(point).applyMatrix4(camera.matrixWorldInverse)
      point.project(camera)
      const visible = !cameraMoving.current && eye.z < -camera.near && Math.abs(point.x) < 1.02 && Math.abs(point.y) < 1.02
      button.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) continue
      const x = (point.x + 1) * size.width / 2, y = (1 - point.y) * size.height / 2
      const transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -50%)`
      // Size follows physical distance, so adjacent small controls never overlap.
      const physicalWidth = isMcduKey(name) ? .009 : .01925
      const pixels = `${Math.max(3, physicalWidth * focal / -eye.z).toFixed(2)}px`
      if (button.style.transform !== transform) button.style.transform = transform
      if (button.style.width !== pixels) { button.style.width = pixels; button.style.height = pixels }
    }
  })
  return null
}
