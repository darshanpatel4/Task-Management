
'use server';

import { createClient } from '@supabase/supabase-js';
import type { Note, NoteCategory } from '@/types';
import { z } from 'zod';
import 'dotenv/config'

// Server action to get all notes using the service role key - REMOVED TO USE PUBLIC CLIENT

interface UpdateNoteResult {
    success: boolean;
    message: string;
}

const updateNoteSchema = z.object({
    noteId: z.string().uuid(),
    title: z.string().min(3, 'Title is required.'),
    content: z.string().min(10, 'Content is required.'),
    category: z.string(),
});

export async function updateNoteContent(formData: {
    noteId: string;
    title: string;
    content: string;
    category: NoteCategory;
}): Promise<UpdateNoteResult> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return { success: false, message: 'Server environment not configured for admin actions.' };
    }

    const validation = updateNoteSchema.safeParse(formData);
    if (!validation.success) {
        return { success: false, message: validation.error.errors.map(e => e.message).join(', ') };
    }

    const { noteId, title, content, category } = validation.data;

    try {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { error } = await supabaseAdmin
            .from('notes')
            .update({
                title,
                content,
                category,
                updated_at: new Date().toISOString(),
            })
            .eq('id', noteId);

        if (error) throw error;

        return { success: true, message: 'Note updated successfully.' };
    } catch (e: any) {
        console.error('Error in updateNoteContent server action:', e);
        return { success: false, message: e.message || 'An unexpected error occurred.' };
    }
}

// Keep the public-facing actions in this file as well for organization.
const verifyNotePassword = async (formData: {
  noteId: string;
  password?: string;
  isToken?: boolean;
}) => {
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

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const validation = requestNoteEditAccessSchema.safeParse(formData);
    if (!validation.success) {
        const errorMessages = validation.error.errors.map((e) => e.message).join(', ');
        return { success: false, message: `Invalid input: ${errorMessages}` };
    }
    const { noteId, name, email } = validation.data;
    
    try {
        const { data: existingRequest, error: checkError } = await supabaseClient
            .from('note_edit_requests')
            .select('status')
            .eq('note_id', noteId)
            .eq('requester_email', email)
            .in('status', ['pending', 'approved'])
            .maybeSingle();

        if (checkError) {
            console.error('Error checking for existing requests:', checkError);
        }

        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                return { success: false, message: "You already have a pending request to edit this note. The administrator will review it shortly." };
            }
            if (existingRequest.status === 'approved') {
                 return { success: false, message: "Your request has already been approved. Please check your email for the edit link." };
            }
        }

        const { error } = await supabaseClient
            .from('note_edit_requests')
            .insert({
                note_id: noteId,
                requester_name: name,
                requester_email: email,
                status: 'pending'
            });

        if (error) {
            console.error('Error creating note edit request:', error);
            if (error.code === '23503') {
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
