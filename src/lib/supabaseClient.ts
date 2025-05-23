// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    console.log("Supabase client initialized successfully.");
  } catch (error) {
    console.error("Error initializing Supabase client:", error);
    // supabaseInstance remains null
  }
} else {
  const message = "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) " +
                  "are not set. Supabase features will be disabled, and the app will use mock data.";
  if (typeof window !== 'undefined') {
    console.warn(message + " (Client-side)");
  } else {
    console.warn(message + " (Server-side)");
  }
  console.log("Supabase client is NOT initialized. Falling back to mock data if applicable.");
}

export const supabase = supabaseInstance;
