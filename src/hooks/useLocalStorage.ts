import { useState } from 'react'

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  function set(val: T) {
    setValue(val)
    localStorage.setItem(key, JSON.stringify(val))
  }

  return [value, set]
}
