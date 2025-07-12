// src/lib/supabaseAdmin.ts
import 'dotenv/config'; // Force load environment variables
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_ADMIN_ERROR: NEXT_PUBLIC_SUPABASE_URL is not set in the environment.');
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_ADMIN_ERROR: SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
}

// Create a single instance of the Supabase client for admin operations
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log('Supabase admin client initialized successfully.');
