import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from('storage')
      .select('value')
      .eq('key', key)
      .single()
    if (error || !data) throw new Error(`Key not found: ${key}`)
    return { key, value: data.value }
  },

  async set(key, value) {
    const { error } = await supabase
      .from('storage')
      .upsert({ key, value, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    return { key, value }
  },

  async delete(key) {
    const { error } = await supabase
      .from('storage')
      .delete()
      .eq('key', key)
    if (error) throw new Error(error.message)
    return { key, deleted: true }
  },

  async list(prefix = '') {
    const { data, error } = await supabase
      .from('storage')
      .select('key')
      .like('key', `${prefix}%`)
    if (error) throw new Error(error.message)
    return { keys: data.map(r => r.key), prefix }
  },
}
