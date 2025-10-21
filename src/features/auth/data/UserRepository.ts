// UserRepository.ts
import { supabase } from '../../../infrastructure/database/supabaseClient'

export const userRepository = {
  async findByEmail(email: string) {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single()
    if (error) return null
    return data
  },

  async create(user: { email: string; password: string }) {
    const { data, error } = await supabase.from('users').insert(user).select().single()
    if (error) throw error
    return data
  },
}
