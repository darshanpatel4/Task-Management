
'use server';

// This file is being deprecated in favor of a dedicated API route.
// It can be safely removed once all dependencies are updated.
// The getAllNotesAdmin function has been moved to /api/get-all-notes/route.ts

export async function getAllNotesAdmin() {
  // This function is deprecated. Use the /api/get-all-notes endpoint.
  console.warn("DEPRECATED: getAllNotesAdmin server action called. Please migrate to using the /api/get-all-notes API route.");
  return { 
    success: false, 
    message: 'This server action is deprecated. Please use the API route.', 
    notesData: [], 
    profilesData: [] 
  };
}
