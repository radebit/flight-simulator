import { AC_POWER, DC_POWER, ECAM_PAGE, HYD_PRESSURE, type SimState } from '../sim/engine'
import { controlLayout, controls } from './cockpitControls'

export function lampStates(s: SimState): Record<string, boolean> {
  const dc = DC_POWER(s), ac = AC_POWER(s), t = s.systems.fireTest
  const lamps: Record<string, boolean> = {
    ...Object.fromEntries(Object.keys(controlLayout).filter(name => Object.keys(controls).some(control => name.startsWith(control) && /^[12][A-Z]$/.test(name.slice(control.length)))).map(name => [name, false])),
    BatteryBtn12O: dc && !s.batteries[0], BatteryBtn22O: dc && !s.batteries[1],
    ExtPwrBtn1A: s.systems.groundPowerConnected && !s.externalPower, ExtPwrBtn2O: s.externalPower && s.systems.groundPowerConnected,
    APUMasterBtn2O: dc && s.apuMaster, APUStartBtn1A: s.apuRpm >= 95, APUStartBtn2O: dc && s.apuStarting && s.apuRpm < 95,
    APUBleedBtn2O: dc && s.apuBleed, APUGenBtn2O: dc && !s.systems.apuGenerator,
    APUGenBtn1F: ac && s.apuMaster && s.apuRpm < 95, CrewOxyBtn2O: dc && !s.systems.crewOxygen,
    CabinFansBtn2O: dc && !s.systems.cabinFans, YellowElecPump2O: dc && s.systems.yellowElectric,
    PTU22O: dc && !s.systems.ptu, GreenEngPump22O: dc && !s.systems.hydraulicPumps[0], YellowEngPump2O: dc && !s.systems.hydraulicPumps[1],
    GreenEngPump21F: ac && s.systems.hydraulicPumps[0] && HYD_PRESSURE(s,0) === 0,
    YellowEngPump1F: ac && s.systems.hydraulicPumps[1] && HYD_PRESSURE(s,2) === 0,
    WingAntiIceBtn2O: dc && s.systems.wingAntiIce, PrbWinHeatBtn2O: dc && s.systems.probeHeat,
    fd1_led: ac && s.fcu.fd, fd2_led: ac && s.fcu.fd,
    lgear_down: dc, ngear_down: dc, rgear_down: dc,
    firebtn1: dc && t === 0, firebtnapu: dc && t === 1, firebtn2: dc && t === 2,
    engine_fire_1: dc && t === 0, engine_fire_2: dc && t === 2,
  }
  const pumpNames = ['LFuelTank1Btn', 'LFuelTank2Btn', 'CFuelTank1Btn', 'CFuelTank2Btn', 'RFuelTank1Btn', 'RFuelTank2Btn']
  pumpNames.forEach((name,i) => { lamps[`${name}2O`] = dc && !s.pumps[i]; lamps[`${name}1F`] = ac && s.pumps[i] && s.systems.fuel[i < 2 ? 0 : i < 4 ? 1 : 2] <= 0 })
  for (const i of [0,1]) {
    lamps[`Gen${i+1}Btn2O`] = dc && !s.systems.engineGenerators[i]
    lamps[`Gen${i+1}Btn1F`] = ac && s.systems.engineGenerators[i] && s.engineN2[i] < 58
    lamps[`ACPack${i+1}Btn2O`] = dc && !s.systems.packs[i]
    lamps[`Eng${i+1}BleedBtn2O`] = dc && !s.systems.engineBleeds[i]
    lamps[`Eng${i+1}AntiIceBtn2O`] = dc && s.systems.antiIce[i]
  }
  for (const name of Object.keys(controlLayout)) {
    if (/^(Eng[12]FireAgt[12]|APUFireAgt)Btn[12][SD]$/.test(name)) lamps[name] = dc && t === (name.startsWith('Eng1') ? 0 : name.startsWith('APU') ? 1 : 2)
    if (/^ecam_\w+_led$/.test(name)) lamps[name] = ac && ECAM_PAGE(s) === name.slice(5,-4).replace('fctl','f/ctl').toUpperCase()
  }
  if (s.systems.lampTest && dc) for (const name of Object.keys(lamps)) lamps[name] = true
  return lamps
}
// Physical fire handles always remain present; only their emissive appearance changes.
export const persistentLamps = new Set(['firebtn1', 'firebtnapu', 'firebtn2'])

export const hasUnlitLegend = (name: string) => /(?:Btn|Pump|PTU)\d*[12][A-Z]$/.test(name)
