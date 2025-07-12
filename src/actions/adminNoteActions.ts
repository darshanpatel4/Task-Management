
'use server';

import { createClient } from '@supabase/supabase-js';

// This function is guaranteed to run only on the server.
export async function getAllNotesAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const errorMessage = 'Server environment for database admin access is not configured correctly. Please check .env.local file.';
    console.error(`getAllNotesAdmin Error: ${errorMessage}`);
    return { 
      success: false, 
      message: errorMessage,
      notesData: [], 
      profilesData: [] 
    };
  }

  // Initialize the admin client INSIDE the function.
  // This is the key change to ensure it runs in the correct server context.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: notesData, error: notesError } = await supabaseAdmin
      .from('notes')
      .select('id, title, content, admin_id, recipient_user_ids, created_at, updated_at, category, visibility')
      .order('created_at', { ascending: false });

    if (notesError) throw notesError;

    const allUserIds = new Set<string>();
    (notesData || []).forEach(note => {
      allUserIds.add(note.admin_id);
      if (note.recipient_user_ids) {
        note.recipient_user_ids.forEach((id: string) => allUserIds.add(id));
      }
    });

    let profilesData: any[] = [];
    if (allUserIds.size > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        // Log a warning but don't fail the entire request if profiles can't be fetched
        console.warn('Warning: Could not fetch some profiles for notes admin page:', profilesError.message);
      } else {
        profilesData = profiles || [];
      }
    }
    
    return { 
      success: true, 
      message: 'Success', 
      notesData: notesData || [], 
      profilesData: profilesData 
    };

  } catch (error: any) {
    // This will catch errors from the database query itself
    console.error('Error in getAllNotesAdmin server action:', { message: error.message, details: error.details, code: error.code });
    return { 
        success: false, 
        message: error.message || 'An unknown server error occurred in getAllNotesAdmin.', 
        notesData: [], 
        profilesData: [] 
    };
  }
}
