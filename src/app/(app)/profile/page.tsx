
'use client';

import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud } from 'lucide-react';

export default function ProfilePage() {
  const { currentUser, loading, setCurrentUser: updateAuthContextUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid File Type', description: 'Please select an image file.', variant: 'destructive' });
        setSelectedFile(null);
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: 'File Too Large', description: 'Please select an image smaller than 5MB.', variant: 'destructive' });
        setSelectedFile(null);
        event.target.value = '';
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    } else {
      setSelectedFile(null);
    }
  };

  const handleAvatarUpload = async () => {
    if (!selectedFile || !currentUser || !supabase) {
      setUploadError('No file selected, user not available, or Supabase client not ready.');
      toast({ title: 'Upload Error', description: 'Cannot upload: No file selected, user not available, or Supabase client not ready.', variant: 'destructive'});
      return;
    }

    if (!currentUser.id) {
      setUploadError('Current user ID is missing. Cannot proceed with upload.');
      toast({ title: 'Upload Error', description: 'Your user ID is missing. Please re-login and try again.', variant: 'destructive'});
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `avatar.${fileExtension}`; // Consistent naming for easier overwriting/cache busting
      const filePath = `public/${currentUser.id}/${fileName}`;

      console.log(`Attempting to upload avatar for user ID: ${currentUser.id} to path: ${filePath}`); // Log user ID and path

      const { data: uploadData, error: uploadSupabaseError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, {
          cacheControl: '3600', // Cache for 1 hour
          upsert: true, // Overwrite if file already exists
        });

      if (uploadSupabaseError) {
        console.error(
          'Error uploading avatar. Raw Supabase Error:', uploadSupabaseError,
          'Name:', (uploadSupabaseError as any)?.name,
          'Message:', (uploadSupabaseError as any)?.message,
          'Status:', (uploadSupabaseError as any)?.status,
          'Stack:', (uploadSupabaseError as any)?.stack,
          'Error (nested):', (uploadSupabaseError as any)?.error
        );
        throw new Error((uploadSupabaseError as any)?.message || (uploadSupabaseError as any)?.error?.message || 'Failed to upload avatar to storage. Check console for details.');
      }

      if (!uploadData || !uploadData.path) {
          throw new Error('Avatar upload successful but path not returned from storage.');
      }
      
      // Construct public URL. Adding a timestamp query parameter for cache busting.
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadData.path, {
           // transform: { width: 200, height: 200, resize: 'cover' } // Optional: server-side resize
        });
        
      if (!urlData || !urlData.publicUrl) {
        throw new Error('Could not retrieve public URL for avatar.');
      }
      
      const publicAvatarUrlWithCacheBust = `${urlData.publicUrl}?t=${new Date().getTime()}`;

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicAvatarUrlWithCacheBust }) // Store URL with cache buster
        .eq('id', currentUser.id);

      if (profileUpdateError) {
        console.error('Error updating profile avatar_url:', profileUpdateError);
        // Attempt to remove the uploaded file if profile update fails
        await supabase.storage.from('avatars').remove([uploadData.path]);
        throw new Error(profileUpdateError.message || 'Failed to update profile with new avatar.');
      }

      // Update user context
      const updatedUser = { ...currentUser, avatar: publicAvatarUrlWithCacheBust };
      updateAuthContextUser(updatedUser);

      toast({ title: 'Success', description: 'Profile picture updated successfully!' });
      setSelectedFile(null); // Clear selected file
      // Clear the file input
      const fileInput = document.getElementById('avatar-upload-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Avatar upload process error:', error);
      setUploadError(error.message || 'An unexpected error occurred.');
      toast({ title: 'Upload Failed', description: error.message || 'Could not update profile picture.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };


  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading profile...</p></div>;
  if (!currentUser) {
    router.push('/auth/login'); // Should be handled by layout, but as a fallback
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">My Profile</CardTitle>
          <CardDescription>View and manage your profile information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24 ring-2 ring-primary/50 ring-offset-2 ring-offset-background" data-ai-hint="user avatar large">
              <AvatarImage src={currentUser.avatar || `https://placehold.co/150x150.png`} alt={currentUser.name} />
              <AvatarFallback className="text-3xl">{currentUser.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <Label htmlFor="avatar-upload-input" className="text-sm font-medium sr-only">
                Choose avatar image
              </Label>
              <Input 
                id="avatar-upload-input" 
                type="file" 
                accept="image/png, image/jpeg, image/gif, image/webp" 
                onChange={handleFileChange}
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground text-center">Selected: {selectedFile.name}</p>
              )}
              <Button 
                onClick={handleAvatarUpload} 
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}
                Upload Avatar
              </Button>
            </div>
            {uploadError && <p className="text-sm text-destructive text-center">{uploadError}</p>}
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue={currentUser.name} readOnly className="bg-muted/50 border-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue={currentUser.email} readOnly className="bg-muted/50 border-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="position">Position</Label>
              <Input id="position" defaultValue={currentUser.position || 'Not set'} readOnly className="bg-muted/50 border-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <Input id="role" defaultValue={currentUser.role} readOnly className="bg-muted/50 border-muted" />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
             <h3 className="text-lg font-semibold">Password</h3>
             <Button variant="outline" disabled>Change Password (Not Implemented)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

