
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Note } from '@/types';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, AlertTriangle, Save, Ban } from 'lucide-react';
import Link from 'next/link';

const editFormSchema = z.object({
  content: z.string().min(10, 'Note content must be at least 10 characters.'),
});
type EditFormValues = z.infer<typeof editFormSchema>;

export default function PublicNoteEditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteId = params.id as string;
  const { toast } = useToast();

  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editToken, setEditToken] = useState<string | null>(null);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { content: '' },
  });

  const verifyAccessAndFetchNote = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (!noteId) {
        setError("Note ID not found.");
        setIsLoading(false);
        return;
    }
    
    const token = searchParams.get('token');
    if (!token) {
        setError("No edit access token found in the URL. Please use the link from your approval email.");
        setIsLoading(false);
        return;
    }
    setEditToken(token);

    try {
        if (!supabase) throw new Error("Database client not available.");
        
        // Verify the token is valid and for the correct note
        const { data: requestData, error: requestError } = await supabase
            .from('note_edit_requests')
            .select('id')
            .eq('note_id', noteId)
            .eq('edit_token', token)
            .eq('status', 'approved')
            .single();
        
        if (requestError || !requestData) {
            throw new Error("This edit link is invalid or has expired. Please request access again.");
        }

        const { data, error: fetchError } = await supabase
            .from('notes')
            .select('id, title, content')
            .eq('id', noteId)
            .single();
        
        if (fetchError || !data) throw fetchError || new Error("Note not found.");

        setNote(data as Note);
        form.reset({ content: data.content });

    } catch(e: any) {
        setError(e.message || "Failed to load note content.");
    } finally {
        setIsLoading(false);
    }
  }, [noteId, form, searchParams]);

  useEffect(() => {
    verifyAccessAndFetchNote();
  }, [verifyAccessAndFetchNote]);

  async function onSubmit(values: EditFormValues) {
    if (!noteId || !editToken) {
        toast({ title: 'Error', description: 'Cannot save, missing note ID or edit token.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    try {
        const response = await fetch('/api/update-note-public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                noteId,
                content: values.content,
                editToken,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'An unknown error occurred.');
        }

        toast({ title: 'Note Saved!', description: 'Your changes have been saved successfully.' });
        router.push(`/notes/${noteId}`);
    } catch (e: any) {
        toast({ title: 'Error Saving Note', description: e.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="ml-2">Verifying access and loading editor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-destructive p-4">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-center">{error}</p>
        <Button variant="outline" asChild className="mt-4">
            <Link href={`/notes/${noteId}`}>Return to Note</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-background py-8 sm:py-12 md:py-16">
        <div className="max-w-4xl w-full mx-auto space-y-6 px-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Editing Note: {note?.title}</CardTitle>
                            <CardDescription>Make your changes below and save. This is a one-time edit session.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="sr-only">Note Content</FormLabel>
                                    <FormControl>
                                        <RichTextEditor 
                                            value={field.value} 
                                            onChange={field.onChange}
                                            placeholder="Write your note here..."
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                             <Button type="button" variant="outline" onClick={() => router.push(`/notes/${noteId}`)} disabled={isSubmitting}>
                                <Ban className="mr-2 h-4 w-4" /> Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    </div>
  )
}
