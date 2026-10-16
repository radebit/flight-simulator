import { lazy, Suspense, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3, Expand, Gauge, Grid2X2, Layers3, ListChecks, MapPin, Pause, Plane, Play, Plus, Radio, RotateCcw, Settings2, ShieldCheck, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react'
import { FlightAudio, type AudioStatus } from './audio/FlightAudio'
import type { TimeOfDay } from './scene/AirportEnvironment'
import { aircraft, views, type View } from './sim/aircraft'
import { AC_POWER, ALIGNED, ENGINES_RUNNING, formatTime, initialState, POWER_SOURCE, restoreState, simReducer, steps, type Action } from './sim/engine'

const AircraftScene = lazy(() => import('./scene/AircraftScene'))
const CockpitScene = lazy(() => import('./scene/CockpitScene'))
// Keep the existing storage key so renaming the app preserves saved sessions.
const SAVE_KEY = 'aerodeck.session.v1'
function savedSession() { try { return restoreState(localStorage.getItem(SAVE_KEY)) } catch { return null } }
const viewIcons = { cockpit: Grid2X2, overhead: Layers3, fcu: Gauge, mcdu: Radio, pedestal: SlidersHorizontal, exterior: Plane }

function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button, input, select, a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key === 'Tab') {
        const items = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a, [tabindex="0"]')
        if (!items?.length) return
        if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus() }
  }, [])
  return <div className="modal-backdrop" onClick={close}><div className="modal" ref={ref} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭弹窗" onClick={close}><X size={20} /></button></div>{children}</div></div>
}

export default function App() {
  const [state, dispatch] = useReducer(simReducer, undefined, () => savedSession() || initialState())
  const [entered, setEntered] = useState(false)
  const [tab, setTab] = useState<'hangar' | 'learn' | 'log'>('hangar')
  const [view, setView] = useState<View>('cockpit')
  const [scenario, setScenario] = useState('cold')
  const [mode, setMode] = useState('guided')
  const [paused, setPaused] = useState(false)
  const [rate, setRate] = useState(5)
  const [sound, setSound] = useState(true)
  const [volume, setVolume] = useState(.55)
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle')
  const [time, setTime] = useState<TimeOfDay>('day')
  const [hidden, setHidden] = useState(document.hidden)
  const [sidebar, setSidebar] = useState(true)
  const [modal, setModal] = useState<'settings' | 'aircraft' | 'help' | 'reset' | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [highlight, setHighlight] = useState<string>()
  const stateRef = useRef(state)
  const audio = useRef<FlightAudio | null>(null)
  stateRef.current = state
  const nextStep = steps.find(step => !state.milestones.includes(step.id))
  const completed = steps.filter(step => state.milestones.includes(step.id)).length
  const progress = Math.round(completed / steps.length * 100)

  useEffect(() => {
    if (!entered || paused) return
    const interval = setInterval(() => { if (!document.hidden) dispatch({ type: 'tick', dt: .2 * rate, realDt: .2 }) }, 200)
    return () => clearInterval(interval)
  }, [entered, paused, rate])
  useEffect(() => {
    const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(stateRef.current)); setStorageError(false) } catch { setStorageError(true) } }
    const interval = setInterval(save, 2000)
    window.addEventListener('pagehide', save)
    return () => { clearInterval(interval); window.removeEventListener('pagehide', save); save() }
  }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t) }, [toast])
  useEffect(() => { if (state.events[0]?.level === 'warning') setToast(state.events[0].message) }, [state.events[0]?.message])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!entered || modal || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, select, .mcdu-hardware, .mcdu-active, [contenteditable]')) return
      const v = views.find(v => v.key === e.key)
      if (v) { e.preventDefault(); setView(v.id) }
      if (e.code === 'Space' && !(e.target as HTMLElement).closest('button, a')) { e.preventDefault(); setPaused(v => !v) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [entered, modal])
  useEffect(() => {
    audio.current = new FlightAudio(setAudioStatus)
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { audio.current?.dispose(); audio.current = null; document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  useEffect(() => { audio.current?.update(state, { enabled: sound, volume, active: entered && !paused && !hidden, exterior: view === 'exterior' }) }, [state, sound, volume, entered, paused, hidden, view])
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 999px)')
    const fitWorkspace = () => { if (narrow.matches) setSidebar(false) }
    narrow.addEventListener('change', fitWorkspace)
    fitWorkspace()
    return () => narrow.removeEventListener('change', fitWorkspace)
  }, [])

  function act(a: Action) {
    dispatch(a)
    audio.current?.unlock()
    audio.current?.action(a)
  }
  function launch(resume = false) {
    audio.current?.unlock()
    if (!resume) dispatch({ type: 'reset', ready: scenario === 'powered' })
    setEntered(true); setPaused(false); setView('cockpit'); setSidebar(mode === 'guided' && window.innerWidth >= 1000); setHighlight(undefined)
  }
  function locate(step = nextStep) { if (!step) return; setView(step.view); setHighlight(step.id); if (window.innerWidth < 1000) setSidebar(false) }
  function exportLog() {
    const blob = new Blob([JSON.stringify({ aircraft: aircraft.id, exportedAt: new Date().toISOString(), simulation: state }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'flight-simulator-a320-session.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast('本次模拟记录已导出。')
  }
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { setToast('此浏览器暂不支持全屏，请使用浏览器的全屏菜单。') } }
  const ready = ENGINES_RUNNING(state) && ALIGNED(state) && state.ignition === 'NORM'

  return <div className={`app ${entered ? 'in-simulator' : ''}`}>
    <header className="app-header"><button className="brand" aria-label="返回机库" onClick={() => { setEntered(false); setTab('hangar') }}><span className="brand-mark"><Plane size={22} fill="currentColor" strokeWidth={1.2} /></span><span>FLIGHT<span className="brand-light"> SIMULATOR</span></span></button>
      {!entered ? <nav className="header-nav" aria-label="主导航">{([{ id: 'hangar', label: '机库', icon: Grid2X2 }, { id: 'learn', label: '学习资料', icon: BookOpen }, { id: 'log', label: '飞行记录', icon: Clock3 }] as const).map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}><t.icon size={15} />{t.label}</button>)}</nav> : <div className="session-breadcrumb"><button onClick={() => setEntered(false)}>机库</button><ChevronRight size={13} /><span>A320neo</span><span className="session-badge">{ready ? 'ENGINES RUNNING' : 'GROUND SESSION'}</span></div>}
      <div className="header-actions">{entered ? <><button className="session-clock" onClick={() => setPaused(v => !v)} title={paused ? '继续模拟' : '暂停模拟'} aria-label={paused ? '继续模拟' : '暂停模拟'}>{paused ? <Play size={14} /> : <Pause size={14} />}<span>{formatTime(state.elapsed)}</span></button><select className="rate-select" aria-label="模拟时间倍率" value={rate} onChange={e => setRate(+e.target.value)}><option value={1}>1× 实时</option><option value={5}>5× 训练</option><option value={10}>10× 训练</option></select><span className="header-divider" /><button className="icon-button" aria-label={sound ? '关闭音效' : '开启音效'} title="驾驶舱与环境音效" onClick={() => { audio.current?.unlock(); setSound(v => !v) }}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button><button className="icon-button fullscreen-button" aria-label="切换全屏" onClick={fullscreen}><Expand size={17} /></button></> : <span className="local-badge"><span className="status-dot" />本地模拟 <span>V0.1</span></span>}<button className="icon-button" aria-label="打开设置" title="设置" onClick={() => setModal('settings')}><Settings2 size={18} /></button></div>
    </header>

    {!entered ? <main className="hangar-main">
      {tab === 'hangar' && <><div className="page-heading"><div><div className="eyebrow"><span className="tiny-line" />YOUR NEXT FLIGHT STARTS HERE</div><h1>每一次起飞，<span>从这里开始。</span></h1><p>选择你的飞机，走进驾驶舱，掌控每一个细节。</p></div><span className="hangar-index">01 <span>/ 机库</span></span></div>
        <div className="hangar-workspace"><section className="aircraft-showcase"><div className="showcase-top"><span className="aircraft-tag">AIRBUS <span>COMMERCIAL AIRCRAFT</span></span><span className="available-label"><span className="status-dot" />可供驾驶</span></div><div className="aircraft-wordmark">A320<span>neo</span></div><Suspense fallback={<div className="scene-loading">正在载入 3D 机库…</div>}><AircraftScene /></Suspense><div className="showcase-bottom"><span><span className="registration-label">REGISTRATION</span><strong>{aircraft.registration}</strong></span><span className="aircraft-view-label">精密系统。直觉操控。<small>THE SKY IS YOUR CLASSROOM.</small></span><button className="round-button" aria-label="查看 A320neo 机型资料" onClick={() => setModal('aircraft')}><ArrowUpRight size={21} /></button></div></section>
          <section className="flight-setup"><div className="setup-heading"><span className="eyebrow">YOUR AIRCRAFT</span><button className="text-button" onClick={() => setModal('aircraft')}>机型资料 <ArrowUpRight size={13} /></button></div><h2>Airbus A320neo</h2><p className="aircraft-description">双发窄体客机 · 电传操纵 · CFM LEAP-1A</p><div className="aircraft-specs"><div><span>最大航程</span><strong>6,300 <small>km</small></strong></div><div><span>翼展</span><strong>35.80 <small>m</small></strong></div><div><span>最大起飞重量</span><strong>79 <small>t</small></strong></div></div><div className="setup-divider" />
            <div className="field-label"><span>初始状态</span><span>STARTING STATE</span></div><div className="scenario-options"><button className={`scenario-option ${scenario === 'cold' ? 'selected' : ''}`} aria-pressed={scenario === 'cold'} onClick={() => setScenario('cold')}><span className="radio-dot" /><span><strong>冷舱启动</strong><small>Cold & Dark · 从零开始</small></span><span className="recommend-badge">推荐</span></button><button className={`scenario-option ${scenario === 'powered' ? 'selected' : ''}`} aria-pressed={scenario === 'powered'} onClick={() => setScenario('powered')}><span className="radio-dot" /><span><strong>地面电源已接通</strong><small>Powered · 专注面板操作</small></span></button></div>
            <div className="field-label mode-label"><span>模拟模式</span><span>SIMULATION MODE</span></div><div className="mode-switch"><button className={mode === 'guided' ? 'selected' : ''} aria-pressed={mode === 'guided'} onClick={() => setMode('guided')}><ListChecks size={16} />引导练习</button><button className={mode === 'free' ? 'selected' : ''} aria-pressed={mode === 'free'} onClick={() => setMode('free')}><SlidersHorizontal size={16} />自由探索</button></div>
            <div className="location-line"><MapPin size={14} /><span>训练机场 · A12 停机位</span><span>日间 / 地面场景</span></div><button className="primary-button launch-button" onClick={() => launch()}>进入驾驶舱 <ArrowRight size={19} /></button><span className="launch-note"><ShieldCheck size={12} />浏览器本地运行 · 进度自动保存</span>{state.elapsed > 0 && <button className="resume-button" onClick={() => launch(true)}>继续上次模拟 <span>{formatTime(state.elapsed)} <ArrowUpRight size={12} /></span></button>}
          </section></div>
        <div className="hangar-bottom"><div className="fleet-section"><div className="section-caption"><h3>我的机队 <span>01</span></h3><span>YOUR FLEET</span></div><button className="fleet-card selected" onClick={() => setModal('aircraft')}><span className="fleet-plane"><Plane size={31} strokeWidth={1.2} /></span><span><strong>Airbus A320neo</strong><small>A320-251N · 窄体客机</small></span><Check size={17} /></button><div className="fleet-card future"><span className="fleet-plane"><Plus size={23} strokeWidth={1} /></span><span><strong>下一段旅程</strong><small>更多机型，未来陆续加入</small></span><span className="coming-label">COMING SOON</span></div></div>
          <div className="training-card"><span className="training-icon"><BookOpen size={23} strokeWidth={1.4} /></span><div><span className="eyebrow">FIRST TIME IN THE COCKPIT?</span><h3>从冷舱，到准备就绪。</h3><p>{steps.length} 个引导步骤，认识飞机的每一个系统。</p><button className="text-button" onClick={() => { setScenario('cold'); setMode('guided'); setTab('learn') }}>查看操作指南 <ArrowUpRight size={14} /></button></div><span className="training-number">01—{steps.length}</span></div></div>
      </>}
      {tab === 'learn' && <div className="library-page"><div className="page-heading"><div><span className="eyebrow">PILOT'S LIBRARY</span><h1>熟悉你的驾驶舱。</h1><p>先理解系统，再完成每一次操作。</p></div><button className="primary-button" onClick={() => { setMode('guided'); launch() }}>开始练习 <ArrowRight size={17} /></button></div><div className="library-grid">{views.slice(1).map((v, i) => { const Icon = viewIcons[v.id]; return <article className="library-card" key={v.id}><span className="library-number">0{i + 1}</span><Icon size={29} strokeWidth={1.2} /><h2>{v.label}</h2><span className="eyebrow">{v.english}</span><p>{['管理电源、燃油、APU、引气和外部灯光。冷舱启动从这里开始。', '通过 PFD、ND 与 ECAM 观察状态，用 FCU 调节目标速度、航向和高度。', '使用 INIT 页面录入起降机场、航班号、成本指数及巡航高度。', '管理发动机主开关、点火模式、推力、襟翼和停机刹车。', '查看灯光、发动机与襟翼，控制 GPU 和轮挡，切换机场光照。'][i]}</p><button className="text-button" onClick={() => { launch(state.elapsed > 0); setView(v.id) }}>打开面板 <ArrowUpRight size={14} /></button></article> })}</div></div>}
      {tab === 'log' && <div className="log-page"><div className="page-heading"><div><span className="eyebrow">SESSION LOGBOOK</span><h1>每一步，都有迹可循。</h1><p>当前保存在本机的最近一次模拟记录。</p></div><button className="secondary-button" onClick={exportLog}><ArrowDownToLine size={16} />导出记录</button></div><div className="log-summary"><div><span>飞机</span><strong>A320neo</strong></div><div><span>模拟时间</span><strong>{formatTime(state.elapsed)}</strong></div><div><span>流程进度</span><strong>{completed} <small>/ {steps.length}</small></strong></div><div><span>当前供电</span><strong>{POWER_SOURCE(state)}</strong></div></div><div className="full-log">{state.events.map((event, i) => <div key={i}><time>{formatTime(event.time)}</time><span className={`event-dot ${event.level}`} /><p>{event.message}</p><span>{event.level.toUpperCase()}</span></div>)}</div></div>}
      <footer className="hangar-footer"><span><span className="footer-mark">✳</span> 为探索而生，为飞行而造。</span><span>FLIGHT SIMULATOR <span className="muted">/</span> A320 PROCEDURE SIMULATOR <span className="muted">/</span> EARLY ACCESS</span><button onClick={() => setModal('help')}>操作帮助 <CircleHelp size={13} /></button></footer>
    </main> : <>
      <div className="sim-toolbar"><nav aria-label="驾驶舱面板">{views.map(v => { const Icon = viewIcons[v.id]; return <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => setView(v.id)}><Icon size={16} /><span>{v.label}</span><kbd>{v.key}</kbd></button> })}</nav><div><button className={`icon-button ${sidebar ? 'selected' : ''}`} aria-label={sidebar ? '收起检查单' : '显示检查单'} title="操作检查单" onClick={() => setSidebar(v => !v)}><ListChecks size={18} /></button><button className="icon-button" aria-label="重新开始冷舱启动" title="重新开始" onClick={() => setModal('reset')}><RotateCcw size={16} /></button></div></div>
      <main className={`sim-workspace ${sidebar ? 'with-sidebar' : ''}`}><section className="sim-stage">{paused && <div className="paused-banner"><Pause size={13} />模拟已暂停 <button onClick={() => setPaused(false)}>继续 <Play size={11} /></button></div>}<Suspense fallback={<div className="scene-loading">正在进入驾驶舱…</div>}>{view === 'exterior' ? <AircraftScene state={state} session time={time} onTime={setTime} dispatch={act} /> : <CockpitScene state={state} dispatch={act} onView={setView} initialView={view} highlight={highlight || nextStep?.id} time={time} onKeySound={() => audio.current?.oneShot('key')} />}</Suspense></section>
        {sidebar && <aside className="checklist-sidebar"><div className="checklist-heading"><div><span className="eyebrow">GUIDED SESSION</span><h2>冷舱启动</h2></div><span className="checklist-icon"><ListChecks size={21} /></span></div><div className="progress-label"><span>操作进度</span><strong>{completed}<span> / {steps.length}</span></strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><div className="checklist-steps">{steps.map((step, i) => { const done = state.milestones.includes(step.id), current = step.id === nextStep?.id; return <button key={step.id} className={`checklist-step ${done ? 'done' : ''} ${current ? 'current' : ''}`} onClick={() => locate(step)}><span className="step-number">{done ? <Check size={12} /> : String(i + 1).padStart(2, '0')}</span><span><strong>{step.title}</strong><small>{step.label}</small></span>{current && <ChevronRight size={14} />}</button> })}</div><div className="checklist-detail">{nextStep ? <><span className="eyebrow">NEXT ACTION</span><h3>{nextStep.title}</h3><p>{nextStep.detail}</p><button className="primary-button" onClick={() => locate()}>定位操作面板 <ArrowUpRight size={15} /></button></> : <><CheckCheck size={25} className="green-text" /><h3>冷舱启动练习完成</h3><p>你已完成本轮 {steps.length} 个操作步骤。继续探索面板，或导出此次操作记录。</p><button className="secondary-button" onClick={exportLog}>导出记录 <ArrowDownToLine size={14} /></button></>}</div><span className="checklist-note">完成标记记录本轮操作，不代表当前开关状态。</span></aside>}
      </main><footer className="sim-footer"><div><span className={`status-dot ${AC_POWER(state) ? '' : 'dim-dot'}`} /><span>{POWER_SOURCE(state)}</span><span className="footer-separator" /><span>APU <b>{state.apuRpm >= 95 ? 'AVAIL' : `${state.apuRpm.toFixed(0)}%`}</b></span><span className="footer-separator" /><span>ENG 1 <b>{state.engineN2[0] >= 67 ? 'RUN' : 'OFF'}</b></span><span>ENG 2 <b>{state.engineN2[1] >= 67 ? 'RUN' : 'OFF'}</b></span></div><div><span className="save-status">{storageError ? '无法自动保存' : '本地自动保存'}</span><button className={logOpen ? 'selected' : ''} onClick={() => setLogOpen(v => !v)}><Clock3 size={13} />操作日志 <ChevronDown size={12} /></button></div></footer>
      {logOpen && <div className="log-drawer"><div className="modal-heading"><h3>操作日志 <small>{state.events.length} EVENTS</small></h3><div><button className="icon-button" onClick={exportLog} aria-label="导出操作日志"><ArrowDownToLine size={16} /></button><button className="icon-button" aria-label="关闭操作日志" onClick={() => setLogOpen(false)}><X size={17} /></button></div></div><div className="drawer-events">{state.events.map((event, i) => <div className={`drawer-event ${event.level}`} key={i}><time>{formatTime(event.time)}</time><p>{event.message}</p></div>)}</div></div>}
    </>}

    {toast && <div role="status" className="toast"><InfoIcon /><span>{toast}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setToast('')}><X size={15} /></button></div>}
    {modal === 'settings' && <Modal title="模拟设置" close={() => setModal(null)}><div className="setting-row"><div><strong>模拟时间倍率</strong><p>同时影响 APU、惯导和发动机启动计时。</p></div><select value={rate} onChange={e => setRate(+e.target.value)}><option value={1}>1× 实时</option><option value={5}>5× 训练</option><option value={10}>10× 训练</option></select></div><div className="setting-row"><div><strong>驾驶舱与环境音效</strong><p>开关、通风、APU、发动机与火警测试。{audioStatus === 'loading' ? '正在加载声音…' : audioStatus === 'unavailable' ? '部分音频未加载，刷新可重试。' : ''}</p></div><button className={`switch ${sound ? 'on' : ''}`} role="switch" aria-checked={sound} aria-label="操作音效" onClick={() => { audio.current?.unlock(); setSound(v => !v) }}><span /></button></div><div className="setting-row"><div><strong>音量</strong><p>{Math.round(volume * 100)}%</p></div><input aria-label="音效音量" type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={e => setVolume(+e.target.value / 100)} /></div><div className="setting-row"><div><strong>机场光照</strong><p>同时影响驾驶舱窗外和外部视角。</p></div><select aria-label="机场光照" value={time} onChange={e => setTime(e.target.value as TimeOfDay)}><option value="day">日间</option><option value="sunset">黄昏</option><option value="night">夜间</option></select></div><div className="setting-row"><div><strong>操作检查单</strong><p>在模拟舱右侧显示引导流程。</p></div><button className={`switch ${sidebar ? 'on' : ''}`} role="switch" aria-checked={sidebar} aria-label="操作检查单" onClick={() => setSidebar(v => !v)}><span /></button></div><div className="modal-info">模拟进度保存在当前浏览器。切回机库、隐藏网页或暂停模拟时，系统计时停止。原型以固定地面场景进行流程练习。</div></Modal>}
    {modal === 'aircraft' && <Modal title="Airbus A320neo" close={() => setModal(null)}><span className="eyebrow">A320-251N / CFM LEAP-1A</span><p className="modal-description">{aircraft.description}</p><div className="aircraft-detail-grid">{[['机身长度', '37.57 m'], ['翼展', '35.80 m'], ['最大航程', '6,300 km'], ['最大起飞重量', '79 t'], ['驾驶舱', '双人制 · 侧杆操纵'], ['发动机', '2 × CFM LEAP-1A']].map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><div className="modal-info">当前采用 FlightGear A320-family 精细模型（GPL-2.0），包含完整座舱布局、原位交互和冷舱启动流程。模型精度不等同于系统仿真精度，部分系统尚未实现。</div><a className="text-button source-link" target="_blank" rel="noreferrer" href={aircraft.sources[0].url}>查看 Airbus 官方机型资料 <ArrowUpRight size={14} /></a></Modal>}
    {modal === 'help' && <Modal title="操作帮助" close={() => setModal(null)}><div className="help-keys">{views.map(v => <div key={v.id}><span>{v.label}</span><kbd>{v.key}</kbd></div>)}<div><span>暂停 / 继续模拟</span><kbd>Space</kbd></div><div><span>关闭弹窗</span><kbd>Esc</kbd></div></div><div className="modal-info">在 3D 场景中拖动环顾、右键平移、滚轮缩放。直接点击模型按钮；旋钮上用滚轮或方向键调整，Shift + 点击减小。火警测试和灯光测试按钮需按住，松开结束。在 MCDU 内输入时，数字键用于输入而非切换面板。建议使用电脑或平板横屏。</div></Modal>}
    {modal === 'reset' && <Modal title="重新开始冷舱启动" close={() => setModal(null)}><p className="modal-description">将重置当前飞机状态和本轮操作记录，回到 Cold & Dark。你可以先导出记录。</p><div className="modal-buttons"><button className="secondary-button" onClick={exportLog}><ArrowDownToLine size={15} />导出记录</button><button className="primary-button" onClick={() => { act({ type: 'reset' }); setModal(null); setPaused(false); setHighlight(undefined); setView('overhead') }}>重新开始 <RotateCcw size={15} /></button></div></Modal>}
  </div>
}

function InfoIcon() { return <CircleHelp size={18} /> }
