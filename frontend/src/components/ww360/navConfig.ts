import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Droplets,
  GraduationCap,
  LayoutDashboard,
  PenSquare,
  Link2,
  Map,
  Globe,
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
  /** Query string without leading ? (e.g. tab=ceu) */
  search?: string;
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
      {
        label: 'CEU & renewals',
        path: '/continuity/ceu-training',
        icon: GraduationCap,
        search: 'tab=ceu',
      },
      {
        label: 'Training calendar',
        path: '/continuity/ceu-training',
        icon: BookOpen,
        search: 'tab=training',
      },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [{ label: 'Document Studio', path: '/studio', icon: PenSquare }],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    items: [
      { label: 'Digital reach', path: '/analytics', icon: Globe },
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

export function navItemTo(item: NavItem): string {
  const q = item.search ? `?${item.search}` : '';
  const hash = item.hash ? `#${item.hash}` : '';
  return `${item.path}${q}${hash}`;
}

export function navGroupsForRoles(roles: string[], districts: string[] = []): NavGroup[] {
  const r = new Set(roles);
  const hasDistrict = districts.some(Boolean);
  const isExecOnly =
    (r.has('platform_admin') || r.has('oww_partner')) &&
    !hasDistrict &&
    !r.has('district_admin') &&
    !r.has('district_manager') &&
    !r.has('ceu_manager') &&
    !r.has('workforce_manager') &&
    !r.has('district_operator') &&
    !r.has('ceu_user');
  const isDistrictManager =
    r.has('district_admin') ||
    r.has('district_manager') ||
    r.has('ceu_manager') ||
    r.has('workforce_manager') ||
    r.has('ceu_admin');
  const isOperator =
    (r.has('ceu_user') || r.has('district_operator') || r.has('workforce_operator')) &&
    !isDistrictManager;

  if (isExecOnly) {
    return ww360NavGroups;
  }

  if (isOperator || (hasDistrict && isOperator)) {
    return [
      {
        id: 'today',
        label: 'Home',
        items: [{ label: 'My dashboard', path: '/dashboard', icon: LayoutDashboard }],
      },
      {
        id: 'learning',
        label: 'Learning',
        items: [
          {
            label: 'CEU & renewals',
            path: '/continuity/ceu-training',
            icon: GraduationCap,
            search: 'tab=ceu',
          },
          {
            label: 'Training calendar',
            path: '/continuity/ceu-training',
            icon: BookOpen,
            search: 'tab=training',
          },
        ],
      },
      {
        id: 'content',
        label: 'Content',
        items: [{ label: 'Document Studio', path: '/studio', icon: PenSquare }],
      },
    ];
  }

  // District managers / admins — utility-only nav (no statewide SDWIS / analytics / admin).
  return [
    {
      id: 'today',
      label: 'Today',
      items: [{ label: 'District dashboard', path: '/dashboard', icon: LayoutDashboard }],
    },
    {
      id: 'workforce',
      label: 'Workforce',
      items: [
        { label: 'Continuity workspace', path: '/continuity', icon: Workflow },
        { label: 'Succession board', path: '/continuity', icon: BarChart3, search: 'tab=succession' },
      ],
    },
    {
      id: 'learning',
      label: 'Learning',
      items: [
        {
          label: 'CEU & renewals',
          path: '/continuity/ceu-training',
          icon: GraduationCap,
          search: 'tab=ceu',
        },
        {
          label: 'Training calendar',
          path: '/continuity/ceu-training',
          icon: BookOpen,
          search: 'tab=training',
        },
      ],
    },
    {
      id: 'content',
      label: 'Content',
      items: [{ label: 'Document Studio', path: '/studio', icon: PenSquare }],
    },
  ];
}
