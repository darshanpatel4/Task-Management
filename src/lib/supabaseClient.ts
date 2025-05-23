// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // It's recommended to store the session in LocalStorage
        // and automatically refresh the token.
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch (error) {
    console.error("Error initializing Supabase client:", error);
    // supabaseInstance remains null
  }
} else {
  // This message will appear in the server console during build/dev and in browser console.
  if (typeof window !== 'undefined') { // Only log in browser if env vars are client-side
    console.warn(
      "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) " +
      "are not set or are not prefixed with NEXT_PUBLIC_ for client-side access. " +
      "Supabase features will be disabled, and the app will use mock data."
    );
  } else {
    // Server-side log
     console.warn(
      "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) " +
      "are not set. Supabase features will be disabled, and the app will use mock data."
    );
  }
}

export const supabase = supabaseInstance;
