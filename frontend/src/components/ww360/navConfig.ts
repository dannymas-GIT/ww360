import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Briefcase,
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
import type { WorkspaceProfile } from '@/utils/workspaceProfile';

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
    id: 'national',
    label: 'National',
    items: [
      { label: 'US overview', path: '/national', icon: Globe },
      { label: 'State scorecards', path: '/national', icon: Map },
    ],
  },
  {
    id: 'water-systems',
    label: 'Water Systems',
    items: [
      { label: 'Landscape', path: '/water-systems', icon: Droplets },
      { label: 'Watchlist', path: '/water-systems/watchlist', icon: Shield },
      { label: 'System lookup', path: '/water-systems/lookup', icon: Map },
      { label: 'Analysis', path: '/water-systems/analysis', icon: BarChart3 },
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
    id: 'careers',
    label: 'Careers',
    items: [{ label: 'Job openings', path: '/jobs', icon: Briefcase }],
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
      { label: 'Jurisdictions', path: '/admin/jurisdictions', icon: Map },
      { label: 'Linked utilities', path: '/admin/pwsid-links', icon: Link2 },
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

export function navGroupsForRoles(
  roles: string[],
  districts: string[] = [],
  options?: { kitchenSink?: boolean; workspaceProfile?: WorkspaceProfile }
): NavGroup[] {
  const kitchenSink = options?.kitchenSink ?? false;
  const profile = options?.workspaceProfile ?? 'state_partner';
  const full = navGroupsForRolesFull(roles, districts);
  if (kitchenSink) return full;
  return navGroupsSimplified(profile, roles, districts, full);
}

function navGroupsForRolesFull(roles: string[], districts: string[] = []): NavGroup[] {
  const r = new Set(roles);
  const hasDistrict = districts.some(Boolean);
  const isExecOnly =
    (r.has('platform_admin') ||
      r.has('oww_partner') ||
      r.has('state_admin') ||
      r.has('national_observer')) &&
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
    const groups = [...ww360NavGroups];
    const isNational =
      r.has('platform_admin') || r.has('national_observer') || r.has('global_admin');
    if (!isNational) {
      return groups.filter(g => g.id !== 'national');
    }
    return groups;
  }

  if (isOperator || (hasDistrict && isOperator)) {
    return [
      {
        id: 'today',
        label: 'Home',
        items: [{ label: 'My dashboard', path: '/dashboard', icon: LayoutDashboard }],
      },
      {
        id: 'careers',
        label: 'Careers',
        items: [{ label: 'Job openings', path: '/jobs', icon: Briefcase }],
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

  // District managers / admins — utility nav includes district PWS linking.
  return [
    {
      id: 'today',
      label: 'Today',
      items: [{ label: 'District dashboard', path: '/dashboard', icon: LayoutDashboard }],
    },
    {
      id: 'water-systems',
      label: 'Water Systems',
      items: [
        { label: 'Our water system', path: '/water-systems/compliance', icon: Droplets },
        { label: 'Find PWS', path: '/water-systems/lookup', icon: Map },
      ],
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
      id: 'careers',
      label: 'Careers',
      items: [{ label: 'Job openings', path: '/jobs', icon: Briefcase }],
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

function navGroupsSimplified(
  profile: WorkspaceProfile,
  roles: string[],
  districts: string[],
  fullNav: NavGroup[]
): NavGroup[] {
  const studioGroup = fullNav.find(g => g.id === 'content') ?? {
    id: 'content',
    label: 'Content',
    items: [{ label: 'Document Studio', path: '/studio', icon: PenSquare }],
  };

  const todayLabel =
    profile === 'utility'
      ? districts.length
        ? 'District dashboard'
        : 'My dashboard'
      : profile === 'national' || profile === 'regional'
        ? 'US overview'
        : 'Executive overview';

  const todayPath =
    profile === 'national' || profile === 'regional' ? '/national' : '/dashboard';

  const today: NavGroup = {
    id: 'today',
    label: 'Today',
    items: [{ label: todayLabel, path: todayPath, icon: LayoutDashboard }],
  };

  const careersGroup: NavGroup = {
    id: 'careers',
    label: 'Careers',
    items: [{ label: 'Job openings', path: '/jobs', icon: Briefcase }],
  };

  const extras: NavGroup[] = [];

  if (profile === 'national' || profile === 'regional') {
    extras.push({
      id: 'national',
      label: 'National',
      items: [{ label: 'State scorecards', path: '/national', icon: Map }],
    });
  }

  if (profile === 'state_partner' || profile === 'regulator') {
    extras.push({
      id: 'water-systems',
      label: 'Water Systems',
      items: [{ label: 'Landscape', path: '/water-systems', icon: Droplets }],
    });
    extras.push({
      id: 'workforce',
      label: 'Workforce',
      items: [{ label: 'Continuity workspace', path: '/continuity', icon: Workflow }],
    });
  }

  if (profile === 'utility') {
    extras.push({
      id: 'workforce',
      label: 'Workforce',
      items: [{ label: 'Continuity workspace', path: '/continuity', icon: Workflow }],
    });
    extras.push({
      id: 'learning',
      label: 'Learning',
      items: [
        {
          label: 'CEU & renewals',
          path: '/continuity/ceu-training',
          icon: GraduationCap,
          search: 'tab=ceu',
        },
      ],
    });
  }

  return [today, ...extras, careersGroup, studioGroup];
}
