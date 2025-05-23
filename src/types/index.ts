
export type UserRole = 'Admin' | 'User';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string; // URL to avatar image
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Approved';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string; // uuid
  title: string;
  description: string;
  assignee_id?: string; // User ID (from profiles)
  assigneeName?: string; // Denormalized for easy display
  dueDate?: string; // ISO date string
  priority: TaskPriority;
  project_id: string; // uuid
  projectName?: string; // Denormalized for easy display
  status: TaskStatus;
  created_at: string; // ISO date string
  user_id?: string; // uuid, creator
  logs?: TaskLog[];
  comments?: TaskComment[];
}

export interface Project {
  id: string; // uuid
  name: string;
  description?: string;
  user_id?: string | null; // uuid, creator, can be null if user is deleted
  created_at?: string; // ISO date string
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
  children?: NavItem[];
}
