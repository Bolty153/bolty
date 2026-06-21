import Combobox from '../Combobox'
import type { BankAccount } from '../../hooks/useBankAccounts'

export interface AccountState {
  name: string
  save: boolean
  bank: string
  number: string
  alias: string
  holder: string
}

export const emptyAccount = (): AccountState => ({ name: '', save: false, bank: '', number: '', alias: '', holder: '' })

export default function AccountFields({ accounts, value, onChange }: {
  accounts: BankAccount[]
  value: AccountState
  onChange: (v: AccountState) => void
}) {
  const set = (patch: Partial<AccountState>) => onChange({ ...value, ...patch })

  // ¿La cuenta escrita coincide con una guardada?
  const matched = accounts.find(a => a.name.trim().toLowerCase() === value.name.trim().toLowerCase())
  const showDetails = !!matched || value.save

  return (
    <div className="field">
      <label>¿A qué cuenta entró?</label>
      <Combobox
        value={value.name}
        onChange={n => set({ name: n })}
        items={accounts}
        getLabel={a => a.name}
        getSub={a => a.bank}
        onPick={a => onChange({
          name: a.name, save: false,
          bank: a.bank ?? '', number: a.number ?? '', alias: a.alias_cbu ?? '', holder: a.holder ?? '',
        })}
        placeholder="Elegí una guardada o escribí una nueva"
      />

      {/* El checkbox de guardar sólo para cuentas nuevas (no para una ya guardada) */}
      {!matched && (
        <label className="svc-check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={value.save} onChange={e => set({ save: e.target.checked })} />
          Guardar esta cuenta para la próxima
        </label>
      )}

      {showDetails && (
        <>
          {matched && <div className="hint" style={{ marginTop: 10 }}>Datos de la cuenta seleccionada:</div>}
          <div className="acc-grid">
            <input type="text" placeholder="Banco (ej: Banco Nación)" value={value.bank} onChange={e => set({ bank: e.target.value })} />
            <input type="text" placeholder="Número de cuenta" value={value.number} onChange={e => set({ number: e.target.value })} />
            <input type="text" placeholder="Alias / CBU" value={value.alias} onChange={e => set({ alias: e.target.value })} />
            <input type="text" placeholder="Titular" value={value.holder} onChange={e => set({ holder: e.target.value })} />
          </div>
        </>
      )}
    </div>
  )
}
