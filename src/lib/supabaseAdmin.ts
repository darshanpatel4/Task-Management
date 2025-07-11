// src/lib/supabaseAdmin.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Note: this is NOT a 'use server' file. It is a shared utility for server-side code.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  // This warning will be logged on the server during build time or on first access.
  console.warn(
    'Supabase admin client could not be initialized. ' +
    'Check that NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local file. ' +
    'Admin-level server actions will fail.'
  );
}

// Export the singleton instance
export { supabaseAdmin };
