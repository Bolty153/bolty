import { useState } from 'react'

const days = [
  { label: 'Lun', num: 16 },
  { label: 'Mar', num: 17 },
  { label: 'Mié', num: 18 },
  { label: 'Jue', num: 19 },
  { label: 'Vie', num: 20 },
  { label: 'Sáb', num: 21 },
]

const appointments = [
  { time: '09:00', type: 'm', title: 'Consulta — Rocky (labrador)', detail: 'Martín G. · Vacunación anual' },
  { time: '10:30', type: '', title: 'Control — Michi (gato)', detail: 'Laura P. · Seguimiento' },
  { time: '12:00', type: null, title: '', detail: '' },
  { time: '15:00', type: 'a', title: 'Peluquería — Toby (caniche)', detail: 'Sofía R. · Baño y corte' },
  { time: '16:30', type: '', title: 'Consulta — Luna (gata)', detail: 'Pedro M. · Desparasitación' },
]

export default function Agenda() {
  const [selectedDay, setSelectedDay] = useState(17)

  const dayName = days.find(d => d.num === selectedDay)?.label ?? ''

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div><h1>Agenda y turnos</h1><div className="sub">Lo que Pelusa reservó por vos</div></div>
        </div>
      </div>

      <div className="ahead">
        {days.map(d => (
          <div key={d.num} className={`dp${selectedDay === d.num ? ' sel' : ''}`} onClick={() => setSelectedDay(d.num)}>
            <span>{d.label}</span><small>{d.num}</small>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h"><h3>Turnos de hoy · {dayName} {selectedDay}</h3></div>
        <div className="sub">Reservados solos desde WhatsApp</div>
        <div className="cal">
          {appointments.map((a, i) => (
            <>
              <div key={`h-${i}`} className="ch">{a.time}</div>
              <div key={`s-${i}`} className="cs">
                {a.type !== null && a.title && (
                  <div className={`appt${a.type ? ` ${a.type}` : ''}`}>
                    <h5>{a.title}</h5>
                    <span>{a.detail}</span>
                  </div>
                )}
              </div>
            </>
          ))}
        </div>
      </div>
    </>
  )
}
