import { AC_POWER, APU_AVAILABLE, BLEED_PRESSURE, ECAM_PAGE, FIRE_WARNING, HYD_PRESSURE, PACK_FLOW, POWER_SOURCE, STARTER_OPEN, engineN1, fuelFlow, type SimState } from '../sim/engine'
const green = '#65ec8e', white = '#e1e9e3', amber = '#efb34e', cyan = '#66cfe8'
export function drawEcam(c: CanvasRenderingContext2D, s: SimState, upper: boolean) {
  const text = (v: string, x: number, y: number, color = green, size = 20, align: CanvasTextAlign = 'left') => { c.fillStyle = color; c.font = `${size}px monospace`; c.textAlign = align; c.fillText(v,x,y) }
  const line = (x:number,y:number,x2:number,y2:number,color=green) => { c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke() }
  const box = (x:number,y:number,w:number,h:number,color=green) => { c.strokeStyle=color;c.lineWidth=2;c.strokeRect(x,y,w,h) }
  const gauge = (x:number,y:number,r:number,value:number,max:number,label:string,color=green) => {
    c.strokeStyle=white;c.lineWidth=2;c.beginPath();c.arc(x,y,r,Math.PI*.72,Math.PI*2.2);c.stroke()
    const a = Math.PI*.72 + Math.min(1,value/max)*Math.PI*1.48
    line(x,y,x+Math.cos(a)*r,y+Math.sin(a)*r,color)
    text(value.toFixed(label==='EGT'?0:1),x+6,y+15,color,25,'center');text(label,x,y+r+23,white,16,'center')
  }
  if (upper) {
    text(s.throttle ? `THR ${s.throttle.toFixed(0)}%` : 'IDLE', 500, 23, cyan, 18, 'right')
    for(const i of [0,1]) {
      const x=133+i*245
      text(`${i+1}`,x,23,white,19,'center')
      gauge(x,84,45,engineN1(s,i),110,'N1')
      if(s.engineN2[i]>=67) text('AVAIL',x,160,green,16,'center')
      else if(STARTER_OPEN(s,i)) text('START',x,160,cyan,16,'center')
      gauge(x,213,40,s.systems.engineEgt[i],900,'EGT')
      text(s.engineN2[i].toFixed(1),x,300,green,24,'center')
      text(fuelFlow(s,i).toFixed(0),x,331,green,22,'center')
    }
    text('N2',256,300,white,17,'center');text('FF KG/H',256,331,white,15,'center')
    line(15,346,497,346,white)
    text(`FOB  ${Math.round(s.systems.fuel.reduce((a,b)=>a+b,0)/10)*10} KG`,20,373,green,22)
    text(`FLAPS ${s.systems.actualFlaps.toFixed(1)}`,490,373,cyan,16,'right')
    if(FIRE_WARNING(s)) { text(`${['ENG 1','APU','ENG 2'][s.systems.fireTest]} FIRE TEST`,20,412,'#ff4e4d',25);text('FIRE / AGENT / CRC',20,445,amber,19) }
    else {
      const memos = [s.parkingBrake?'PARK BRK':'',s.apuRpm>=95?'APU AVAIL':'',s.seatbelts?'SEAT BELTS':'',s.systems.noSmoking!=='OFF'?'NO SMOKING':''].filter(Boolean)
      memos.forEach((v,i)=>text(v,20+(i%2)*250,410+Math.floor(i/2)*29,green,18))
      if (s.ignition === 'IGN/START') text('IGNITION',490,470,green,17,'right')
    }
    return
  }
  const page=ECAM_PAGE(s)
  text(page,25,32,white,24);line(24,39,24+page.length*14,39,white)
  if(page==='APU') {
    text(APU_AVAILABLE(s)?'AVAIL':s.systems.apuCooldown>0?'COOLDOWN':'',256,71,green,24,'center')
    gauge(145,190,70,s.apuRpm,110,'N %');gauge(375,190,70,s.apuRpm>0?390+s.apuRpm*2:18,1000,'EGT')
    box(40,300,175,100,APU_AVAILABLE(s)?green:amber);text('APU GEN',58,326,white)
    text(APU_AVAILABLE(s)&&s.systems.apuGenerator?'115 V  400 HZ':'--- V  --- HZ',54,369,APU_AVAILABLE(s)?green:amber,17)
    text(`BLEED ${s.apuBleed?'ON':'OFF'}`,288,325,white);text(`${s.apuBleed?BLEED_PRESSURE(s):0} PSI`,295,366)
    text(s.systems.apuFlap>=1?'FLAP OPEN':s.systems.apuFlap>0?'FLAP MOVING':'FLAP CLOSED',40,429,cyan,17)
    if(s.systems.apuCooldown) text(`${Math.ceil(s.systems.apuCooldown)} SEC`,380,429,green,17)
  } else if(page==='ENG') {
    text('1',130,83,white,25);text('2',377,83,white,25)
    for(const i of [0,1]) {
      const x=125+i*250
      text((s.engineN2[i]*1.2).toFixed(0),x,133,green,25,'center')
      text((18+s.engineN2[i]*.82).toFixed(0),x,197,green,25,'center')
      text(s.engineN2[i]>0?'0.2':'0.0',x,260,green,25,'center')
      text(STARTER_OPEN(s,i)?'OPEN':'CLOSED',x,333,STARTER_OPEN(s,i)?green:white,21,'center')
      text(s.engineMaster[i]&&s.engineN2[i]>=20&&s.engineN2[i]<55?'A + B':'OFF',x,396,cyan,20,'center')
    }
    text('OIL PSI',256,118,white,16,'center');text('OIL °C',256,183,white,16,'center');text('VIB',256,247,white,16,'center');text('START VALVE',256,309,white,16,'center');text('IGN',256,377,white,16,'center')
  } else if(page==='ELEC') {
    text(POWER_SOURCE(s),256,80,cyan,23,'center')
    for(const i of [0,1]) {
      const x=35+i*265
      box(x,110,175,92);text(`BAT ${i+1}`,x+20,138,white);text(`${s.batteries[i]&&AC_POWER(s)?'28.0':'25.4'} V`,x+20,178)
      box(x,250,175,56);text(`AC BUS ${i+1}`,x+18,286);line(x+85,202,x+85,250)
      box(x,355,175,65,s.systems.engineGenerators[i]&&s.engineN2[i]>=58?green:amber);text(`GEN ${i+1}`,x+20,381,white);text(s.engineN2[i]>=58&&s.systems.engineGenerators[i]?'115V 400HZ':'OFF LINE',x+15,407,s.engineN2[i]>=58?green:amber,17)
      line(x+85,306,x+85,355)
    }
  } else if(page==='BLEED') {
    text(`APU ${s.apuBleed?'ON':'OFF'}   ${BLEED_PRESSURE(s)} PSI`,256,100,green,23,'center')
    text(`X BLEED  ${s.systems.xbleed}`,256,165,cyan,19,'center');line(130,190,380,190)
    for(const i of [0,1]) { const x=130+i*250;line(x,190,x,350);box(x-68,240,136,56,PACK_FLOW(s,i)?green:amber);text(`PACK ${i+1}`,x,264,white,18,'center');text(PACK_FLOW(s,i)?'FLOW':'CLOSED',x,286,PACK_FLOW(s,i)?green:amber,15,'center');text(`ENG ${i+1}`,x,381,white,21,'center');text(s.systems.engineBleeds[i]&&s.engineN2[i]>=58&&!s.apuBleed?'OPEN':'CLOSED',x,413,s.engineN2[i]>=58?green:amber,18,'center') }
  } else if(page==='FUEL') {
    for(const i of [0,1,2]) {const x=16+i*165;box(x,130,150,130);text(['L TK','CTR TK','R TK'][i],x+75,161,white,20,'center');text(Math.round(s.systems.fuel[i]).toString(),x+75,212,green,25,'center');text('KG',x+75,244,cyan,16,'center')}
    s.pumps.forEach((on,i)=>{const x=35+i*80;box(x,310,42,38,on?green:amber);text(on?'ON':'OFF',x+21,335,on?green:amber,15,'center')})
    text(`TOTAL  ${Math.round(s.systems.fuel.reduce((a,b)=>a+b,0))} KG`,256,408,green,24,'center')
  } else if(page==='HYD') {
    ['GREEN','BLUE','YELLOW'].forEach((v,i)=>{const x=90+i*167;const pressure=HYD_PRESSURE(s,i);text(v,x,92,i===1?cyan:green,21,'center');text(String(pressure),x,151,pressure?green:amber,27,'center');text('PSI',x,183,white,17,'center');line(x,205,x,345,pressure?green:amber);box(x-40,345,80,60);text('RSVR',x,383,white,15,'center')})
    text(`PTU ${s.systems.ptu?'AUTO':'OFF'}`,256,268,white,20,'center')
  } else if(page==='WHEEL') {
    text('GEAR DOWN',256,100,green,25,'center')
    for(const x of [120,390]) {box(x-50,210,40,85);box(x+10,210,40,85);text('20 °C',x,330,green,20,'center');text('REL',x,372,white,17,'center')}
    text(s.parkingBrake?'PARKING BRAKE ON':'PARKING BRAKE OFF',256,424,s.parkingBrake?green:amber,22,'center')
  } else if(page==='F/CTL') {
    text('SLATS / FLAPS',256,100,white,22,'center');text(`SELECTED  ${s.flaps}`,256,164,cyan,23,'center');text(`ACTUAL    ${s.systems.actualFlaps.toFixed(1)}`,256,211,green,23,'center')
    box(56,259,400,35);c.fillStyle=green;c.fillRect(58,261,s.systems.actualFlaps/4*396,31)
    text(HYD_PRESSURE(s,0)||HYD_PRESSURE(s,2)?'HYD PRESSURE AVAILABLE':'HYD PRESSURE LOW',256,366,HYD_PRESSURE(s,0)?green:amber,20,'center')
  } else if(page==='DOOR') {
    box(180,85,150,320);text('CABIN',255,144,white,23,'center');text('DOORS',255,181,white,20,'center');text('CLOSED',255,218,green,23,'center')
    for(const x of [158,330])for(const y of [110,343]){box(x,y,25,43);text('■',x+12,y+29,green,17,'center')}
    text(`OXY ${s.systems.crewOxygen?'REGUL':'OFF'}`,255,330,s.systems.crewOxygen?green:amber,20,'center')
  } else if(page==='COND' || page==='PRESS') {
    text('GROUND',256,96,white,23,'center');text(page==='COND'?'CKPT    FWD    AFT':'CAB ALT    ΔP',256,166,white,23,'center');text(page==='COND'?' 22      22     22 °C':'0 FT    0.0 PSI',256,215,green,23,'center')
    text(`PACK 1 ${PACK_FLOW(s,0)?'FLOW':'CLOSED'}`,60,305,PACK_FLOW(s,0)?green:amber,20);text(`PACK 2 ${PACK_FLOW(s,1)?'FLOW':'CLOSED'}`,280,305,PACK_FLOW(s,1)?green:amber,20)
    text('LDG ELEV AUTO',256,389,cyan,20,'center')
  } else {
    text('GROUND SYSTEM STATUS',256,105,white,23,'center');text(`AC POWER   ${POWER_SOURCE(s)}`,35,177,green,21);text(`FWS        ${s.systems.fwsReady>=50?'READY':'INIT'}`,35,230,green,21);text(`FIRE TESTS ${s.systems.fireChecked.filter(Boolean).length}/3`,35,283,green,21);text('SIMPLIFIED SYSTEM MODEL',256,388,cyan,17,'center')
  }
  line(15,450,497,450,white);text('TAT +18°C',20,474,white,16);text('SAT +18°C',185,474,white,16);text('GW 64000 KG',360,474,green,16)
  c.textAlign='left'
}
