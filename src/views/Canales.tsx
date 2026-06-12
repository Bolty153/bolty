const channels = [
  {
    name: 'WhatsApp',
    detail: '+54 9 341 555-0142',
    connected: true,
    iconStyle: { background: 'var(--mint-wash)', color: 'var(--mint)' },
    icon: (
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.3zM12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z" />
      </svg>
    ),
  },
  {
    name: 'Instagram',
    detail: '@veterinaria.centro',
    connected: true,
    iconStyle: { background: '#fce4f0', color: '#d6248f' },
    icon: (
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.1.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.1-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.1-.4-.3-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.1 1-.3 2.2-.4 1.3-.1 1.7-.1 4.9-.1zM12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4zm0 6.9a2.7 2.7 0 110-5.4 2.7 2.7 0 010 5.4zm5.3-7.1a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
  },
  {
    name: 'Chat en tu web',
    detail: 'Pegás un código y aparece el chat en tu página',
    connected: false,
    iconStyle: { background: 'var(--volt-wash)', color: 'var(--volt)' },
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z" />
      </svg>
    ),
  },
]

export default function Canales() {
  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div><h1>Canales</h1><div className="sub">Dónde responde tu agente</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Tus canales conectados</h3></div>
        <div className="sub">Cada canal usa tu propio número y cuenta. Así nunca se mezcla con otro negocio.</div>
        {channels.map(ch => (
          <div key={ch.name} className="chan">
            <div className="chan-ic" style={ch.iconStyle}>{ch.icon}</div>
            <div className="chan-i">
              <h4>{ch.name}</h4>
              <p>{ch.detail}</p>
            </div>
            <span className={`cst${ch.connected ? ' con' : ' dis'}`}>
              {ch.connected ? 'Conectado' : 'Sin conectar'}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
