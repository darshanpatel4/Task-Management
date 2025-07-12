
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { Note, NoteCategory } from '@/types';
import { noteCategories } from '@/types';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, Save, Ban, Tag, Edit3 } from 'lucide-react';
import Link from 'next/link';

const editFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  content: z.string().min(10, 'Note content must be at least 10 characters.'),
  category: z.enum(noteCategories, { required_error: 'Note category is required.' }),
});
type EditFormValues = z.infer<typeof editFormSchema>;

export default function AdminNoteEditPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { title: '', content: '', category: 'General' },
  });

  const fetchNote = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (!noteId) {
      setError("Note ID not found.");
      setIsLoading(false);
      return;
    }
    if (!isAdmin) {
      setError("You do not have permission to edit this page.");
      setIsLoading(false);
      return;
    }

    try {
      if (!supabase) throw new Error("Database client not available.");
      
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('id, title, content, category')
        .eq('id', noteId)
        .single();
      
      if (fetchError || !data) throw fetchError || new Error("Note not found.");

      setNote(data as Note);
      form.reset({
        title: data.title,
        content: data.content,
        category: (data.category as NoteCategory) || 'General',
      });

    } catch(e: any) {
      setError(e.message || "Failed to load note content for editing.");
    } finally {
      setIsLoading(false);
    }
  }, [noteId, form, isAdmin]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  async function onSubmit(values: EditFormValues) {
    if (!noteId || !supabase) {
      toast({ title: 'Error', description: 'Cannot save, missing note ID or database connection.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    
    try {
        const { error } = await supabase
            .from('notes')
            .update({
                title: values.title,
                content: values.content,
                category: values.category,
                updated_at: new Date().toISOString(),
            })
            .eq('id', noteId);
        
        if (error) throw error;
        
        toast({ title: 'Note Saved!', description: 'Your changes have been saved successfully.' });
        router.push(`/admin/notes/${noteId}`);

    } catch (e: any) {
        toast({ title: 'Error Saving Note', description: e.message || "An unknown error occurred.", variant: 'destructive' });
    }

    setIsSubmitting(false);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="ml-2">Loading editor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive p-4">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Could not load Editor</h2>
        <p className="text-center">{error}</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href={`/admin/notes`}>Return to Notes List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Edit3 className="mr-2 h-6 w-6 text-primary" />
                Editing Note: {note?.title}
              </CardTitle>
              <CardDescription>Make changes to the note details below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Note title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                        <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                        Category
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select note category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {noteCategories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note Content</FormLabel>
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
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
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
  );
}
