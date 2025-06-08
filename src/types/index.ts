
export type UserRole = 'Admin' | 'User';

export interface User {
  id: string;
  name: string; // Corresponds to full_name in profiles
  email: string; // From auth.users (or profiles if denormalized)
  role: UserRole;
  avatar?: string; // URL to avatar image
  position?: string | null; // New field for job title/position
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Approved';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string; // uuid
  title: string;
  description?: string | null;
  assignee_ids?: string[] | null; // Array of User IDs for assignees
  dueDate?: string | null; // ISO date string
  priority?: TaskPriority | null;
  project_id?: string | null; // uuid, foreign key to projects table
  projectName?: string | null; // Denormalized for easy display
  status?: TaskStatus | null;
  created_at?: string | null; // ISO date string, set by DB
  user_id?: string | null; // uuid, creator (from auth.users)
  comments?: TaskComment[] | null;
  logs?: TaskLog[] | null;
}

export type ProjectStatus = 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';

export interface Project {
  id: string; // uuid
  name: string;
  description?: string | null;
  user_id?: string | null; // uuid, creator, can be null if user is deleted
  created_at?: string | null; // ISO date string
  status?: ProjectStatus | null;
}

export interface TaskLog {
  id: string;
  userId: string;
  userName?: string; // Denormalized
  hoursSpent: number;
  workDescription: string;
  date: string; // ISO date string
}

export interface TaskComment {
  id: string;
  userId: string;
  userName?: string; // Denormalized
  userAvatar?: string; // Denormalized
  comment: string;
  createdAt: string; // ISO date string
}

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  activePathPrefix?: string;
  teamViewable?: boolean;
  userSpecific?: boolean; // For items like "My Notes"
}

export type NotificationType =
  | 'new_comment_on_task'
  | 'new_log'
  | 'task_assigned'
  | 'task_approved'
  | 'task_completed_for_approval'
  | 'task_rejected'
  | 'new_note_received' // Added for new notes
  | 'generic';

export interface NotificationItem {
  id: string;
  user_id: string; // Recipient
  message: string;
  link?: string | null;
  created_at: string; // ISO string
  is_read: boolean;
  type: NotificationType;
  triggered_by_user_id?: string | null; // Optional: Who triggered it
  task_id?: string | null; // Optional: Related task
  project_id?: string | null; // Optional: Related project
  note_id?: string | null; // Optional: Related note
  triggered_by_profile?: { full_name?: string | null } | null;
}

export interface Note {
  id: string; // uuid
  title: string;
  content: string;
  admin_id: string; // uuid of the admin who created the note
  admin_name?: string; // denormalized for display
  recipient_user_ids: string[]; // Array of user UUIDs
  recipient_names?: string[]; // denormalized for display
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}
