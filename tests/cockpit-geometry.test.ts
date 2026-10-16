import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { separateOverheadButtonFaces, BUTTON_PRESS_TRAVEL } from '../src/scene/cockpitButtonGeometry'
import { AIRFRAME_GROUND_HEIGHT, AIRPORT_IN_COCKPIT, COCKPIT_IN_AIRFRAME } from '../src/scene/aircraftCoordinates'

function meshesFromGlb(file: string, include: (name: string) => boolean) {
  const bytes = readFileSync(new URL(`../public/models/a320/${file}.glb`, import.meta.url))
  const jsonSize = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonSize))
  const binary = bytes.subarray(28 + jsonSize)
  function attribute(index: number) {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView]
    const size = accessor.type === 'VEC3' ? 3 : 1
    const ArrayType = accessor.componentType === 5126 ? Float32Array : accessor.componentType === 5123 ? Uint16Array : Uint32Array
    const start = (view.byteOffset || 0) + (accessor.byteOffset || 0)
    const data = binary.subarray(start, start + accessor.count * size * ArrayType.BYTES_PER_ELEMENT)
    return new THREE.BufferAttribute(new ArrayType(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)), size)
  }
  const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = []
  for (const node of gltf.nodes) {
    if (!include(node.name)) continue
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', attribute(primitive.attributes.POSITION))
      geometry.setAttribute('normal', attribute(primitive.attributes.NORMAL))
      geometry.setIndex(attribute(primitive.indices))
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      mesh.name = node.name
      meshes.push(mesh)
    }
  }
  return meshes
}

describe('Cockpit geometry regression', () => {
  it('keeps both APU legends in front of the baked panel, even throughout a button press', () => {
    const meshes = meshesFromGlb('cockpit', name => /^APU(Master|Start)Btn/.test(name) || name === 'fd_main')
    const parts = new Map(meshes.map(mesh => [mesh.name, mesh]))
    separateOverheadButtonFaces(parts)
    for (const pressed of [false, true]) {
      for (const mesh of meshes) {
        if (mesh.name === 'fd_main') continue
        mesh.position.set(pressed ? -.36 * BUTTON_PRESS_TRAVEL : 0, pressed ? .93 * BUTTON_PRESS_TRAVEL : 0, 0)
        mesh.updateMatrixWorld(true)
      }
      for (const name of ['APUMasterBtn1F', 'APUMasterBtn2O', 'APUStartBtn1A', 'APUStartBtn2O']) {
        const label = parts.get(name)!
        label.geometry.computeBoundingBox()
        const target = label.geometry.boundingBox!.getCenter(new THREE.Vector3()).add(label.position)
        const origin = new THREE.Vector3(.03, .48, 0)
        const ray = new THREE.Raycaster(origin, target.sub(origin).normalize())
        expect(ray.intersectObjects(meshes)[0]?.object.name, `${name}, pressed=${pressed}`).toBe(name)
      }
    }
    for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose() }
  })

  it('uses the pinned source cockpit transform, with airport and exterior sharing its inverse', () => {
    const xml = readFileSync(new URL('../vendor/flightgear-a320/Models/A320-interior.xml', import.meta.url), 'utf8')
    const x = Number(xml.match(/<x-m>(.*?)<\/x-m>/)![1]), y = Number(xml.match(/<y-m>(.*?)<\/y-m>/)![1]), z = Number(xml.match(/<z-m>(.*?)<\/z-m>/)![1])
    expect(COCKPIT_IN_AIRFRAME).toEqual([x, z, -y])
    const origin = new THREE.Vector3(...COCKPIT_IN_AIRFRAME).add(new THREE.Vector3(...AIRPORT_IN_COCKPIT))
    origin.y += AIRFRAME_GROUND_HEIGHT
    expect(origin.length()).toBeLessThan(1e-10)
  })

  it('aligns forward and side windows for both pilot seats without opaque fuselage obstruction', () => {
    const meshes = meshesFromGlb('exterior', name => ['Fuselage', 'Windsheild'].includes(name))
    for (const mesh of meshes) { mesh.position.fromArray(COCKPIT_IN_AIRFRAME).negate(); mesh.updateMatrixWorld(true) }
    for (const side of [-1, 1]) {
      const origin = new THREE.Vector3(.24, .62, .52 * side)
      for (const direction of [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-.3, 0, side).normalize()]) {
        expect(new THREE.Raycaster(origin, direction).intersectObjects(meshes)[0]?.object.name).toBe('Windsheild')
      }
    }
    for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose() }
  })
})
