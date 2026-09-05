import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  Droplets,
  GraduationCap,
  LayoutDashboard,
  Link2,
  Map,
  Settings,
  Shield,
  Users,
  Workflow,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  hash?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const ww360NavGroups: NavGroup[] = [
  {
    id: 'today',
    label: 'Today',
    items: [{ label: 'Executive overview', path: '/dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'water-systems',
    label: 'Water Systems',
    items: [
      { label: 'Landscape', path: '/water-systems', icon: Droplets },
      { label: 'Watchlist', path: '/water-systems/watchlist', icon: Shield },
      { label: 'System lookup', path: '/water-systems/lookup', icon: Map },
    ],
  },
  {
    id: 'workforce',
    label: 'Workforce',
    items: [
      { label: 'Continuity workspace', path: '/continuity', icon: Workflow },
      { label: 'Regional risk', path: '/dashboard', icon: BarChart3, hash: 'regions' },
    ],
  },
  {
    id: 'learning',
    label: 'Learning',
    items: [
      { label: 'CEU & renewals', path: '/continuity', icon: GraduationCap, hash: 'ceu' },
      { label: 'Training calendar', path: '/continuity', icon: BookOpen, hash: 'training' },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    items: [
      { label: 'EPA measures', path: '/dashboard', icon: ClipboardList, hash: 'epa' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { label: 'PWSID links', path: '/admin/pwsid-links', icon: Link2 },
      { label: 'Users & access', path: '/admin/users', icon: Users },
      { label: 'Settings', path: '/admin/settings', icon: Settings },
    ],
  },
];
