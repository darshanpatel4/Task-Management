
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import type { Note, User, NoteCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Eye, Trash2, Loader2, AlertTriangle, StickyNote, Tag } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface ProfileMap {
  [userId: string]: Pick<User, 'id' | 'name' | 'avatar'>;
}

export default function ManageNotesPage() {
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [profilesMap, setProfilesMap] = useState<ProfileMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotesAndProfiles = useCallback(async () => {
    if (!isAdmin || !supabase) {
      setIsLoading(false);
      setError(isAdmin ? "Supabase client not available." : "Access Denied.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id, title, content, admin_id, recipient_user_ids, created_at, updated_at, category')
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      const allUserIds = new Set<string>();
      (notesData || []).forEach(note => {
        allUserIds.add(note.admin_id);
        if (note.recipient_user_ids) {
            note.recipient_user_ids.forEach(id => allUserIds.add(id));
        }
      });

      let newProfilesMap: ProfileMap = {};
      if (allUserIds.size > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(allUserIds));

        if (profilesError) {
          console.warn('Could not fetch profiles for notes page:', profilesError);
        } else {
          (profilesData || []).forEach(profile => {
            newProfilesMap[profile.id] = { id: profile.id, name: profile.full_name || 'N/A', avatar: profile.avatar_url };
          });
        }
      }
      setProfilesMap(newProfilesMap);

      const mappedNotes: Note[] = (notesData || []).map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        admin_id: note.admin_id,
        admin_name: newProfilesMap[note.admin_id]?.name || 'Unknown Admin',
        recipient_user_ids: note.recipient_user_ids || [],
        recipient_names: (note.recipient_user_ids || []).map(id => newProfilesMap[id]?.name || 'Unknown User'),
        created_at: note.created_at,
        updated_at: note.updated_at,
        category: note.category as NoteCategory || 'General',
      }));
      setNotes(mappedNotes);

    } catch (e: any) {
      console.error('Error fetching notes:', e);
      setError(e.message || 'Failed to load notes.');
      toast({ title: 'Error', description: e.message || 'Could not load notes.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchNotesAndProfiles();
  }, [fetchNotesAndProfiles]);

  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
    if (!supabase) {
      toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
      return;
    }
    if (confirm(`Are you sure you want to delete the note "${noteTitle}"? This action cannot be undone.`)) {
      setIsLoading(true);
      try {
        // Also delete related notifications for this note_id
        const { error: notificationsDeleteError } = await supabase
          .from('notifications')
          .delete()
          .eq('note_id', noteId);

        if (notificationsDeleteError) {
          console.warn('Partial delete: Error deleting notifications for note', noteId, notificationsDeleteError);
           toast({
            title: "Warning: Notifications Deletion Issue",
            description: `Could not delete all notifications for note "${noteTitle}". Note deletion will proceed. Error: ${notificationsDeleteError.message}`,
            variant: "default",
            duration: 7000,
          });
        }
        
        const { error: deleteError } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId);

        if (deleteError) throw deleteError;

        toast({ title: "Note Deleted", description: `Note "${noteTitle}" has been deleted.` });
        fetchNotesAndProfiles(); // Refresh list
      } catch (e: any) {
        toast({ title: "Error Deleting Note", description: e.message || "Could not delete note.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isLoading && !isAdmin) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to manage notes.</p></CardContent>
      </Card>
    );
  }

  const displayRecipients = (note: Note) => {
    const { recipient_user_ids, recipient_names } = note;
    if (!recipient_user_ids || recipient_user_ids.length === 0) return <Badge variant="outline">No Recipients</Badge>;
    
    const namesToDisplay = recipient_names && recipient_names.length === recipient_user_ids.length 
      ? recipient_names 
      : recipient_user_ids.map(id => profilesMap[id]?.name || 'Unknown');

    if (namesToDisplay.length > 2) {
      return <Badge variant="secondary">{namesToDisplay.length} Recipients</Badge>;
    }
    return namesToDisplay.map((name, index) => (
      <Badge key={recipient_user_ids[index]} variant="secondary" className="mr-1 mb-1">{name}</Badge>
    ));
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-3xl font-bold tracking-tight">Manage Notes</h1>
          <p className="text-muted-foreground">Oversee all notes sent to users.</p>
        </div>
        <Link href="/admin/notes/create">
          <Button disabled={isLoading || !supabase}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Note
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notes</CardTitle>
          <CardDescription>List of all notes created by administrators.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading notes...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Notes</p>
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchNotesAndProfiles} disabled={!supabase}>Try Again</Button>
            </div>
          )}
          {!isLoading && !error && notes.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No notes found. Start by creating one!</p>
          )}
          {!isLoading && !error && notes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Sent By</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      <Link href={`/admin/notes/${note.id}`} className="hover:underline text-primary">{note.title}</Link>
                    </TableCell>
                     <TableCell>
                      <Badge variant={getCategoryBadgeVariant(note.category)} className="capitalize">
                        <Tag className="mr-1 h-3 w-3" /> {note.category || 'General'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 hidden sm:flex" data-ai-hint="admin avatar small">
                          <AvatarImage src={profilesMap[note.admin_id]?.avatar || `https://placehold.co/30x30.png`} />
                          <AvatarFallback>{profilesMap[note.admin_id]?.name?.substring(0,1) || 'A'}</AvatarFallback>
                        </Avatar>
                        <span>{profilesMap[note.admin_id]?.name || 'Unknown Admin'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-sm">
                        <div className="flex flex-wrap gap-1">
                            {displayRecipients(note)}
                        </div>
                    </TableCell>
                    <TableCell>{note.created_at ? format(parseISO(note.created_at), 'MMM d, yyyy') : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/notes/${note.id}`}>
                          <Button variant="ghost" size="icon" aria-label="View note" disabled={!supabase}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id, note.title)}
                          aria-label="Delete note"
                          disabled={!supabase || isLoading || currentUser?.id !== note.admin_id}
                          title={currentUser?.id !== note.admin_id ? "Only creator can delete" : "Delete note"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
