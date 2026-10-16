import { assetUrl } from '../assetUrl'

// Aircraft definitions are separate from the simulation and presentation layers.
export const aircraft = {
  id: 'a320neo', manufacturer: 'AIRBUS', name: 'A320neo', variant: 'A320-251N',
  engine: 'CFM LEAP-1A', length: 37.57, wingspan: 35.8, range: 6300, mtow: 79,
  registration: 'SE-ROJ',
  description: '从第一束电源，到双发平稳运转。走进空客驾驶舱，让每一次操作都有回应。',
  sources: [
    { title: 'Airbus · A320neo 机型参数', url: 'https://www.aircraft.airbus.com/en/aircraft/a320-family/a320neo' },
    { title: 'FlightGear · A320-family 模型来源', url: 'https://github.com/legoboyvdlp/A320-family' },
    { title: '模型许可与修改说明', url: assetUrl('models/a320/NOTICE.txt') },
    { title: '模型原始资源与转换脚本', url: assetUrl('models/a320/flightgear-source.tar.gz') },
    { title: 'FlyByWire · 驾驶舱布局与面板', url: 'https://docs.flybywiresim.com/pilots-corner/a32nx/a32nx-briefing/flight-deck/' },
    { title: 'FlyByWire · 冷舱上电流程', url: 'https://docs.flybywiresim.com/pilots-corner/a32nx/a32nx-beginner-guide/starting-the-aircraft/' },
    { title: 'FlyByWire · 发动机启动', url: 'https://docs.flybywiresim.com/pilots-corner/a32nx/a32nx-beginner-guide/engine-start-taxi/' },
    { title: 'FlyByWire · MCDU 操作', url: 'https://docs.flybywiresim.com/pilots-corner/a32nx/a32nx-beginner-guide/preparing-mcdu/' },
  ],
} as const

export type View = 'cockpit' | 'overhead' | 'mcdu' | 'pedestal' | 'fcu' | 'exterior'
export const views: { id: View; label: string; english: string; key: string }[] = [
  { id: 'cockpit', label: '驾驶舱', english: 'FLIGHT DECK', key: '1' },
  { id: 'overhead', label: '顶板', english: 'OVERHEAD', key: '2' },
  { id: 'fcu', label: '主仪表', english: 'MAIN PANEL', key: '3' },
  { id: 'mcdu', label: 'MCDU', english: 'FLIGHT MANAGEMENT', key: '4' },
  { id: 'pedestal', label: '中央操纵台', english: 'PEDESTAL', key: '5' },
  { id: 'exterior', label: '外景', english: 'AIRPORT & EXTERIOR', key: '6' },
]
