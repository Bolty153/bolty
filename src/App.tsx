import { useState } from 'react'
import TopNav from './components/layout/TopNav'
import Sidebar from './components/layout/Sidebar'
import Inicio from './views/Inicio'
import Agente from './views/Agente'
import Funciones from './views/Funciones'
import Reportes from './views/Reportes'
import Agenda from './views/Agenda'
import Canales from './views/Canales'

export type ViewId = 'inicio' | 'agente' | 'funciones' | 'reportes' | 'agenda' | 'canales'

function renderView(view: ViewId) {
  switch (view) {
    case 'inicio':    return <Inicio />
    case 'agente':    return <Agente />
    case 'funciones': return <Funciones />
    case 'reportes':  return <Reportes />
    case 'agenda':    return <Agenda />
    case 'canales':   return <Canales />
  }
}

export default function App() {
  const [view, setView] = useState<ViewId>('inicio')

  return (
    <>
      <TopNav />
      <div className="shell">
        <Sidebar activeView={view} onNavigate={setView} />
        <main className="main">
          <div key={view} className="view-anim">
            {renderView(view)}
          </div>
        </main>
      </div>
    </>
  )
}
