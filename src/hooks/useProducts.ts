import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'

// Umbral para considerar un producto con "stock bajo" (configurable a futuro).
export const LOW_STOCK_THRESHOLD = 5

export interface Product {
  id: string
  user_id?: string
  name: string
  price: number
  stock: number
  category: string | null
  description: string | null
  image_url: string | null
  barcode: string | null
  created_at?: string
}

export interface ProductInput {
  name: string
  price: number
  stock: number
  category?: string | null
  description?: string | null
  image_url?: string | null
  barcode?: string | null
}

/**
 * Maneja el inventario del cliente logueado.
 * Cada operación va contra Supabase filtrando por user_id; la seguridad real
 * la garantiza RLS (cada cliente sólo ve y toca SUS productos).
 */
export function useProducts() {
  const userId = useEffectiveUserId()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Bolty] load products:', error.message)
      setError(error.message)
    } else {
      setProducts(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const addProduct = useCallback(async (input: ProductInput): Promise<Product> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('products')
      .insert({ ...input, user_id: userId })
      .select()
      .single()
    if (error) throw error
    setProducts(prev => [data as Product, ...prev])
    return data as Product
  }, [userId])

  const updateProduct = useCallback(async (id: string, patch: Partial<ProductInput>): Promise<Product> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('products')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setProducts(prev => prev.map(p => (p.id === id ? (data as Product) : p)))
    return data as Product
  }, [userId])

  const deleteProduct = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
    setProducts(prev => prev.filter(p => p.id !== id))
  }, [])

  const importProducts = useCallback(async (rows: ProductInput[]): Promise<number> => {
    if (!userId) throw new Error('No hay sesión activa')
    if (rows.length === 0) return 0
    const payload = rows.map(r => ({ ...r, user_id: userId }))
    const { data, error } = await supabase.from('products').insert(payload).select()
    if (error) throw error
    setProducts(prev => [...((data as Product[]) ?? []), ...prev])
    return data?.length ?? 0
  }, [userId])

  // Aplica nuevos valores de stock a varios productos de una sola vez
  // (lo usan el ajuste masivo y la carga rápida).
  const bulkUpdateStock = useCallback(async (updates: { id: string; stock: number }[]): Promise<void> => {
    if (!userId) throw new Error('No hay sesión activa')
    if (updates.length === 0) return
    await Promise.all(
      updates.map(u => supabase.from('products').update({ stock: u.stock }).eq('id', u.id))
    )
    setProducts(prev => prev.map(p => {
      const u = updates.find(x => x.id === p.id)
      return u ? { ...p, stock: u.stock } : p
    }))
  }, [userId])

  const uploadToBucket = useCallback(async (bucket: string, file: File): Promise<string | null> => {
    if (!userId) return null
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) {
      console.error(`[Bolty] upload ${bucket}:`, error.message)
      throw error
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }, [userId])

  const uploadImage = useCallback((file: File) => uploadToBucket('productos', file), [uploadToBucket])
  const uploadRemito = useCallback((file: File) => uploadToBucket('remitos', file), [uploadToBucket])

  // Busca un producto por su código de barras (para el lector con cámara).
  const findByBarcode = useCallback(
    (code: string) => products.find(p => p.barcode && p.barcode === code.trim()) ?? null,
    [products]
  )

  return {
    products,
    loading,
    error,
    reload: load,
    addProduct,
    updateProduct,
    deleteProduct,
    importProducts,
    bulkUpdateStock,
    uploadImage,
    uploadRemito,
    findByBarcode,
  }
}
