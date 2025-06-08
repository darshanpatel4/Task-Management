
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Note, User, NoteCategory } from '@/types';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Inbox, UserCircle, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ProfileMap {
  [userId: string]: Pick<User, 'id' | 'name' | 'avatar'>;
}

export default function MyNotesPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<ProfileMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyNotes = useCallback(async () => {
    if (!currentUser || !supabase) {
      setIsLoading(false);
      setError(currentUser ? "Supabase client not available." : "You must be logged in to view notes.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id, title, content, admin_id, created_at, category')
        .contains('recipient_user_ids', [currentUser.id])
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      const adminIds = new Set<string>();
      (notesData || []).forEach(note => adminIds.add(note.admin_id));

      let fetchedAdminProfiles: ProfileMap = {};
      if (adminIds.size > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(adminIds));

        if (profilesError) {
          console.warn('Could not fetch admin profiles for notes page:', profilesError);
        } else {
          (profilesData || []).forEach(profile => {
            fetchedAdminProfiles[profile.id] = { id: profile.id, name: profile.full_name || 'Admin', avatar: profile.avatar_url };
          });
        }
      }
      setAdminProfiles(fetchedAdminProfiles);

      const mappedNotes: Note[] = (notesData || []).map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        admin_id: note.admin_id,
        admin_name: fetchedAdminProfiles[note.admin_id]?.name || 'Admin',
        recipient_user_ids: [currentUser.id],
        created_at: note.created_at,
        updated_at: note.created_at,
        category: note.category as NoteCategory || 'General',
      }));
      setNotes(mappedNotes);

    } catch (e: any) {
      console.error('Error fetching your notes:', e);
      setError(e.message || 'Failed to load your notes.');
      toast({ title: 'Error', description: e.message || 'Could not load your notes.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchMyNotes();
  }, [fetchMyNotes]);

  const getCategoryBadgeVariant = (category?: NoteCategory | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (category) {
      case 'Important': return 'destructive';
      case 'Credentials': return 'default';
      case 'Improvement': return 'secondary';
      case 'Action Required': return 'destructive';
      case 'General': return 'outline';
      default: return 'outline';
    }
  };

  if (!currentUser && !isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You must be logged in to view your notes.</p></CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl flex items-center">
            <Inbox className="mr-3 h-8 w-8 text-primary" /> My Notes
          </CardTitle>
          <CardDescription>Notes sent to you by administrators.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading your notes...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Notes</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
          {!isLoading && !error && notes.length === 0 && (
            <p className="text-center text-muted-foreground py-12">You have no new notes.</p>
          )}
          {!isLoading && !error && notes.length > 0 && (
            <div className="space-y-4">
              {notes.map((note) => (
                <Card key={note.id} id={`note-${note.id}`} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="flex-1">
                             <CardTitle className="text-xl mb-1 sm:mb-0">{note.title}</CardTitle>
                             <Badge variant={getCategoryBadgeVariant(note.category)} className="capitalize mt-1 text-xs">
                                <Tag className="mr-1.5 h-3 w-3" /> {note.category || 'General'}
                             </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs mt-2 sm:mt-0 self-start sm:self-auto">
                            Received: {note.created_at ? format(parseISO(note.created_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                        </Badge>
                    </div>
                     <CardDescription className="flex items-center text-xs pt-1.5">
                        <UserCircle className="h-3 w-3 mr-1" /> Sent by: {note.admin_name || 'Admin'}
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {note.content}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
