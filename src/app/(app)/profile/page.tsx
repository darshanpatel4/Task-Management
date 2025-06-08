
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
      // Basic validation (optional: add more specific checks)
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid File Type', description: 'Please select an image file.', variant: 'destructive' });
        setSelectedFile(null);
        event.target.value = ''; // Reset file input
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: 'File Too Large', description: 'Please select an image smaller than 5MB.', variant: 'destructive' });
        setSelectedFile(null);
        event.target.value = ''; // Reset file input
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
      setUploadError('No file selected or user not available.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `avatar.${fileExtension}`;
      // Path inside the bucket: public/user_id/avatar.ext
      // The 'public/' prefix is convention if the bucket itself isn't named 'public' but files within are meant for public URL access.
      // If your bucket is already named 'public', then 'user_id/avatar.ext' is fine.
      // The RLS policies provided assume the path structure 'public/USER_ID/filename.ext' within the 'avatars' bucket.
      const filePath = `public/${currentUser.id}/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadSupabaseError } = await supabase.storage
        .from('avatars') // Your bucket name
        .upload(filePath, selectedFile, {
          cacheControl: '3600', // Cache for 1 hour
          upsert: true, // Overwrite if file with same name exists
        });

      if (uploadSupabaseError) {
        console.error('Error uploading avatar:', uploadSupabaseError);
        throw new Error(uploadSupabaseError.message || 'Failed to upload avatar to storage.');
      }

      if (!uploadData || !uploadData.path) {
          throw new Error('Avatar upload successful but path not returned from storage.');
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadData.path);

      if (!urlData || !urlData.publicUrl) {
        throw new Error('Could not retrieve public URL for avatar.');
      }
      
      const publicAvatarUrl = urlData.publicUrl;

      // Update avatar_url in profiles table
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicAvatarUrl })
        .eq('id', currentUser.id);

      if (profileUpdateError) {
        console.error('Error updating profile avatar_url:', profileUpdateError);
        // Attempt to remove the just-uploaded file if profile update fails
        await supabase.storage.from('avatars').remove([uploadData.path]);
        throw new Error(profileUpdateError.message || 'Failed to update profile with new avatar.');
      }

      // Update currentUser in AuthContext to reflect change immediately
      const updatedUser = { ...currentUser, avatar: publicAvatarUrl };
      updateAuthContextUser(updatedUser); // Assuming setCurrentUser updates localStorage too

      toast({ title: 'Success', description: 'Profile picture updated successfully!' });
      setSelectedFile(null); // Clear selection
      const fileInput = document.getElementById('avatar-upload-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = ''; // Reset file input visually

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
    // Should be handled by layout, but as a fallback
    router.push('/auth/login');
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
