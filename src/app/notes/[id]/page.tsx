
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { Note, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { StickyNote, CalendarDays, UserCircle, Loader2, AlertTriangle, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

// This is a public page, so we don't use useAuth() for access control.
// Data fetching rules (RLS) in Supabase will handle security.

interface ProfileMap {
  [userId: string]: Pick<User, 'id' | 'name' | 'avatar'>;
}

export default function PublicNotePage() {
  const params = useParams();
  const noteId = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [adminProfile, setAdminProfile] = useState<Pick<User, 'id' | 'name' | 'avatar'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const fetchPublicNote = useCallback(async () => {
    if (!noteId) {
      setError('Note ID is missing.');
      setIsLoading(false);
      return;
    }
     if (!supabase) {
      setError('Database connection is not available.');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // RLS Policy should ensure this only returns notes where visibility = 'public'
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('id, title, content, admin_id, created_at, category')
        .eq('id', noteId)
        .single();

      if (fetchError || !data) {
        if (fetchError?.code === 'PGRST116' || !data) {
            setError('This note was not found or is not available.');
        } else {
            throw fetchError;
        }
        setNote(null);
      } else {
        const fetchedNote: Note = {
            id: data.id,
            title: data.title,
            content: data.content,
            admin_id: data.admin_id,
            recipient_user_ids: [], 
            created_at: data.created_at,
            updated_at: data.created_at,
            category: data.category as Note['category'],
        };
        setNote(fetchedNote);

        // Fetch admin profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', data.admin_id)
          .single();

        if (profileError) {
          console.warn('Could not fetch admin profile for public note:', profileError);
          setAdminProfile({ id: data.admin_id, name: 'Admin', avatar: '' });
        } else {
          setAdminProfile({
            id: profileData.id,
            name: profileData.full_name || 'Admin',
            avatar: profileData.avatar_url || '',
          });
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load the note.');
      console.error('Error fetching public note:', e);
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    fetchPublicNote();
  }, [fetchPublicNote]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
        <p>Loading note...</p>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-destructive p-4">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Could Not Load Note</h2>
        <p className="text-center">{error || 'An unknown error occurred.'}</p>
        <Button variant="outline" asChild className="mt-4">
            <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-background py-8 sm:py-12 md:py-16">
        <div className="max-w-4xl w-full mx-auto space-y-6 px-4">
            <Card className="shadow-lg">
                <CardHeader className="border-b">
                <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl md:text-3xl flex items-center">
                            <StickyNote className="w-7 h-7 mr-3 text-primary flex-shrink-0" />
                            {note.title}
                        </CardTitle>
                    </div>
                     <p className="text-xs text-muted-foreground mt-2 sm:mt-0 pt-1">
                        Published on {note.created_at ? format(parseISO(note.created_at), 'PPP') : 'N/A'}
                     </p>
                </div>
                {adminProfile && (
                     <CardDescription className="pt-2">
                        <div className="flex items-center text-sm text-muted-foreground">
                            <UserCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                            Published by:
                            <Avatar className="h-5 w-5 ml-1.5 mr-1" data-ai-hint="admin avatar small">
                                <AvatarImage src={adminProfile.avatar || `https://placehold.co/20x20.png`} />
                                <AvatarFallback className="text-xs">{adminProfile.name?.substring(0,1) || 'A'}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{adminProfile.name}</span>
                        </div>
                    </CardDescription>
                )}
                </CardHeader>
                <CardContent className="pt-6">
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: note.content || 'No content provided.' }} />
                </CardContent>
                 <CardFooter className="bg-muted/50 p-4 text-center text-xs text-muted-foreground justify-center">
                   <p>&copy; {new Date().getFullYear()} TaskFlow AI. All rights reserved.</p>
                </CardFooter>
            </Card>
             <div className="text-center">
                <Button asChild>
                    <Link href="/auth/login">Return to TaskFlow AI</Link>
                </Button>
            </div>
        </div>
    </div>
  );
}
