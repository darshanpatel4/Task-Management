// src/lib/supabaseAdmin.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Note: this is NOT a 'use server' file. It is a shared utility for server-side code.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdminInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("Supabase admin client initialized successfully.");
  } catch (error) {
    console.error("Error initializing Supabase admin client:", error);
  }
} else {
  // This warning is helpful for debugging during development
  console.warn(
    'Supabase admin client could not be initialized. ' +
    'Check that NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment. ' +
    'Admin-level server actions will fail.'
  );
}

// Export the potentially null instance. It's the action's responsibility to handle it.
export const supabaseAdmin = supabaseAdminInstance;
