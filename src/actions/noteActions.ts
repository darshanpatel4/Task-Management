
'use server';

import 'dotenv/config'; // Force load environment variables for this server action
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

const verifyPasswordSchema = z.object({
  noteId: z.string().uuid(),
  password: z.string(),
  isToken: z.boolean().optional(),
});

interface VerifyPasswordResult {
  success: boolean;
  message: string;
  token?: string;
}

export async function verifyNotePassword(formData: {
  noteId: string;
  password?: string;
  isToken?: boolean;
}): Promise<VerifyPasswordResult> {
  if (!supabaseAdmin) {
    const errorMsg = 'Server environment for database access is not configured.';
    console.error(errorMsg);
    return { success: false, message: errorMsg };
  }

  const validation = verifyPasswordSchema.safeParse(formData);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map((e) => e.message).join(', ');
    return { success: false, message: `Invalid input: ${errorMessages}` };
  }

  const { noteId, password, isToken } = validation.data;

  try {
    const { data: note, error } = await supabaseAdmin
      .from('notes')
      .select('security_key')
      .eq('id', noteId)
      .single();

    if (error || !note) {
      return { success: false, message: 'Note not found.' };
    }

    // A note with a NULL security_key is publicly editable.
    if (note.security_key === null) {
      // We can generate a temporary token for the session.
      const tempToken = `public_session_${Math.random().toString(36).substring(2)}`;
      return { success: true, message: 'Access granted.', token: tempToken };
    }

    const keyToCompare = isToken ? note.security_key : password;

    if (note.security_key === keyToCompare) {
        // If password matches, return the password itself as the token for session storage
        return { success: true, message: 'Access granted.', token: note.security_key };
    } else {
        return { success: false, message: 'Incorrect password.' };
    }

  } catch (e: any) {
    console.error('Unexpected error verifying password:', e);
    return { success: false, message: `An unexpected error occurred: ${e.message || 'Unknown error'}` };
  }
}


const updateNoteContentSchema = z.object({
  noteId: z.string().uuid(),
  content: z.string().min(1),
  editToken: z.string().min(1),
});

interface UpdateNoteResult {
  success: boolean;
  message: string;
}

export async function updateNoteContent(formData: {
    noteId: string,
    content: string,
    editToken: string
}): Promise<UpdateNoteResult> {
    if (!supabaseAdmin) {
        return { success: false, message: 'Server environment not configured.' };
    }

    const validation = updateNoteContentSchema.safeParse(formData);
    if (!validation.success) {
        const errorMessages = validation.error.errors.map((e) => e.message).join(', ');
        return { success: false, message: `Invalid input: ${errorMessages}` };
    }
    const { noteId, content, editToken } = validation.data;

    // First, verify the edit token is valid for this note
    const { data: note, error: fetchError } = await supabaseAdmin
        .from('notes')
        .select('security_key')
        .eq('id', noteId)
        .single();
    
    if (fetchError || !note) {
        return { success: false, message: 'Note not found.' };
    }

    // A note with a null security key is publicly editable, but we need to check the session token
    if (note.security_key === null && !editToken.startsWith('public_session_')) {
        return { success: false, message: 'Invalid edit session.' };
    }
    
    if (note.security_key !== null && note.security_key !== editToken) {
        return { success: false, message: 'Invalid edit token.' };
    }

    // Token is valid, proceed with update
    const { error: updateError } = await supabaseAdmin
        .from('notes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', noteId);

    if (updateError) {
        console.error('Error updating note content:', updateError);
        return { success: false, message: `Database error: ${updateError.message}` };
    }

    return { success: true, message: 'Note updated successfully.' };
}
