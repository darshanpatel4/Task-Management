
'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const verifyNotePassword = async (formData: {
  noteId: string;
  password?: string;
  isToken?: boolean;
}) => {
  // This server action is now deprecated in favor of the /api/verify-note-password route.
  // The API route pattern is more stable for handling environment variables.
  // This function is kept to prevent breaking imports but should not be used.
  return {
    success: false,
    message: 'This action is deprecated. Please use the API route.',
  };
};

const requestNoteEditAccessSchema = z.object({
  noteId: z.string().uuid(),
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
});

interface RequestAccessResult {
    success: boolean;
    message: string;
}

export async function requestNoteEditAccess(formData: {
    noteId: string,
    name: string,
    email: string
}): Promise<RequestAccessResult> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
        return { success: false, message: 'Client environment for database access is not configured.' };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const validation = requestNoteEditAccessSchema.safeParse(formData);
    if (!validation.success) {
        const errorMessages = validation.error.errors.map((e) => e.message).join(', ');
        return { success: false, message: `Invalid input: ${errorMessages}` };
    }
    const { noteId, name, email } = validation.data;
    
    try {
        // Check for existing pending or approved requests for this note from this email
        const { data: existingRequest, error: checkError } = await supabase
            .from('note_edit_requests')
            .select('status')
            .eq('note_id', noteId)
            .eq('requester_email', email)
            .in('status', ['pending', 'approved'])
            .maybeSingle();

        if (checkError) {
            console.error('Error checking for existing requests:', checkError);
            // Decide to proceed or not. For now, we'll let it proceed but log the error.
        }

        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                return { success: false, message: "You already have a pending request to edit this note. The administrator will review it shortly." };
            }
            if (existingRequest.status === 'approved') {
                 return { success: false, message: "Your request has already been approved. Please check your email for the edit link." };
            }
        }

        const { error } = await supabase
            .from('note_edit_requests')
            .insert({
                note_id: noteId,
                requester_name: name,
                requester_email: email,
                status: 'pending'
            });

        if (error) {
            console.error('Error creating note edit request:', error);
            if (error.code === '23503') { // Foreign key violation
                return { success: false, message: 'Could not create request: The specified note does not exist.' };
            }
             if (error.message.includes('permission denied')) {
                return { success: false, message: 'Permission denied. Please check database policies for inserting into note_edit_requests.' };
            }
            return { success: false, message: `Database error: ${error.message}` };
        }

        return { success: true, message: "Your request to edit has been sent to the administrator for approval." };

    } catch (e: any) {
        console.error('Unexpected error creating edit request:', e);
        return { success: false, message: `An unexpected error occurred: ${e.message || 'Unknown error'}` };
    }
}

export { verifyNotePassword };
