
'use server';

import { createClient } from '@supabase/supabase-js';

// This action uses the SERVICE_ROLE_KEY to bypass RLS for admin purposes.
// It should only be called from admin-protected routes.
export async function getAllNotesAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Server environment for database admin access is not configured correctly.");
    return { success: false, message: 'Server environment for database admin access is not configured correctly.', notesData: [], profilesData: [] };
  }

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
        note.recipient_user_ids.forEach(id => allUserIds.add(id));
      }
    });

    let profilesData: any[] = [];
    if (allUserIds.size > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.warn('Could not fetch profiles for notes admin page:', profilesError);
        // Continue without profile data if it fails
      } else {
        profilesData = profiles || [];
      }
    }
    
    return { success: true, message: 'Success', notesData: notesData || [], profilesData: profilesData };

  } catch (error: any) {
    console.error('Error in getAllNotesAdmin server action:', error);
    return { success: false, message: error.message || 'An unknown error occurred', notesData: [], profilesData: [] };
  }
}
