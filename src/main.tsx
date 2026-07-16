import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ChatTest from './views/ChatTest.tsx'

// Enganche PROVISORIO para probar el cerebro sin tocar ninguna vista.
// Con  #chat-test  en la URL se muestra la pantalla de prueba; si no, la app normal.
// Cuando llegue la bandeja, borramos ChatTest.tsx y estas dos líneas.
const Root = window.location.hash === '#chat-test' ? ChatTest : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
