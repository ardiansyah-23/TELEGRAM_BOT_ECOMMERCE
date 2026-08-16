import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';

// Initialize the Supabase client
export const supabase = createClient(
  config.SUPABASE_URL!,
  config.SUPABASE_ANON_KEY!
);
