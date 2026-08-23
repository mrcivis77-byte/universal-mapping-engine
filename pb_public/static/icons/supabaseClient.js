import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wokhakjjmrmjtjoorgjg.supabase.co'
const supabaseAnonKey = 'sb_publishable_vKpe-TjsuUp01cieUG8SAQ_i1bWOYjw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)