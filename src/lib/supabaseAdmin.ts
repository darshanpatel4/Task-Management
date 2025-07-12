// src/lib/supabaseAdmin.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Note: this is NOT a 'use server' file. It is a shared utility for server-side code.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Throw an error if the required environment variables are not set.
// This prevents the client from being null and provides a clear error message.
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Supabase admin client could not be initialized. ' +
    'Check that NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment. ' +
    'Admin-level server actions will fail.'
  );
}

// Initialize the client directly. The check above guarantees the variables are present.
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Export the singleton instance
export { supabaseAdmin };
