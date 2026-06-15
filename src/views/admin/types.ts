export interface Plan {
  id: string
  name: string
  price_ars: number
  description: string | null
}

export interface Client {
  id: string
  email: string
  business_name: string | null
  whatsapp: string | null
  plan_id: string | null
  plan?: Plan | null
  status: 'active' | 'inactive' | 'trial' | 'suspended'
  trial_ends_at: string | null
  paid_until: string | null
  notes: string | null
  created_at: string
}

export interface Payment {
  id: string
  client_id: string
  amount: number
  paid_at: string
  method: string
  note: string | null
  period_start: string | null
  period_end: string | null
}

export interface ActivityEntry {
  id: string
  admin_id: string | null
  action: string
  target_id: string | null
  target_type: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  created_at: string
  expires_at: string | null
  created_by: string | null
}
