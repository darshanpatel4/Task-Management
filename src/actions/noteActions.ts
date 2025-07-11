
'use server';

import { supabaseAdmin } from './adminUserActions'; // Import the centralized admin client
import { z } from 'zod';

const requestNoteEditAccessSchema = z.object({
  noteId: z.string().uuid('Invalid Note ID format.'),
  requesterName: z.string().min(2, 'Name must be at least 2 characters.'),
  requesterEmail: z.string().email('A valid email is required.'),
});

interface RequestEditAccessResult {
  success: boolean;
  message: string;
}


export async function requestNoteEditAccess(formData: {
  noteId: string;
  requesterName: string;
  requesterEmail: string;
}): Promise<RequestEditAccessResult> {
  if (!supabaseAdmin) {
    const errorMsg = 'Server environment for database access is not configured.';
    console.error(errorMsg);
    return { success: false, message: errorMsg };
  }

  const validation = requestNoteEditAccessSchema.safeParse(formData);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map((e) => e.message).join(', ');
    return { success: false, message: `Invalid input: ${errorMessages}` };
  }

  const { noteId, requesterName, requesterEmail } = validation.data;

  try {
    const { error } = await supabaseAdmin.from('note_edit_requests').insert([
      {
        note_id: noteId,
        requester_name: requesterName,
        requester_email: requesterEmail,
        status: 'pending',
      },
    ]);

    if (error) {
      console.error('Error creating note edit request:', error);
      // More user-friendly error messages
      if (error.code === '23503') { // foreign key violation
        return { success: false, message: 'The specified note does not exist.' };
      }
      return { success: false, message: `Database error: ${error.message}` };
    }

    // Here you would also trigger a notification for the admin
    // This is a placeholder for that logic
    console.log(`New edit request for note ${noteId} from ${requesterEmail}. Admin notification should be sent.`);


    return { success: true, message: 'Your request has been submitted successfully.' };
  } catch (e: any) {
    console.error('Unexpected error creating note edit request:', e);
    return { success: false, message: `An unexpected error occurred: ${e.message || 'Unknown error'}` };
  }
}
