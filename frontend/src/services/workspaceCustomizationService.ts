import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';
import type {
  DashboardLayoutV2,
  DashboardBlock,
  DashboardRow,
} from '@/components/dashboard/layout/dashboardLayoutTypes';
import { emptyLayout } from '@/components/dashboard/layout/dashboardLayoutTypes';

export interface FoundryModule {
  module_id: string;
  label: string;
  short_label: string;
  description: string;
  kpi_hints: string[];
  category: string;
  kind?: string;
  default_size: 'full' | 'half';
  default_column_span?: number;
  default_row_span?: number;
  allow_row_span?: boolean;
  unique?: boolean;
  profiles: string[];
  icon: string;
}

/** @deprecated Prefer DashboardBlock — kept for tour copy migration */
export interface LayoutItem {
  module_id: string;
  visible: boolean;
  size: 'full' | 'half';
}

export interface WorkspaceLayoutResponse {
  workspace_profile: string;
  persona_key?: string | null;
  layout: DashboardLayoutV2;
  is_default: boolean;
  updated_at?: string | null;
}

function normalizeLayout(raw: unknown): DashboardLayoutV2 {
  if (!raw || typeof raw !== 'object') return emptyLayout();
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(raw)) {
    // Should not happen after API migrate, but guard client-side
    return emptyLayout();
  }
  if (obj.version === 2 && Array.isArray(obj.rows)) {
    return {
      version: 2,
      rows: (obj.rows as DashboardRow[]).map(r => ({
        id: String(r.id),
        blocks: (r.blocks || []).map(
          (b: DashboardBlock): DashboardBlock => ({
            id: String(b.id),
            type: (b.type || 'module') as DashboardBlock['type'],
            module_id: String(b.module_id),
            columnSpan: ([1, 2, 3].includes(Number(b.columnSpan))
              ? Number(b.columnSpan)
              : 1) as DashboardBlock['columnSpan'],
            rowSpan: ([1, 2].includes(Number(b.rowSpan))
              ? Number(b.rowSpan)
              : 1) as DashboardBlock['rowSpan'],
            config: (b.config && typeof b.config === 'object' ? b.config : {}) as Record<
              string,
              unknown
            >,
          })
        ),
      })),
    };
  }
  return emptyLayout();
}

export async function fetchModuleFoundry(profile: WorkspaceProfile): Promise<{
  modules: FoundryModule[];
  default_layout: DashboardLayoutV2;
}> {
  const { data } = await axios.get(`${API_BASE_URL}/workspace/modules`, {
    headers: getAuthHeader(),
    params: { workspace_profile: profile },
  });
  return {
    modules: data.modules,
    default_layout: normalizeLayout(data.default_layout),
  };
}

export async function fetchWorkspaceLayout(
  profile: WorkspaceProfile,
  personaKey?: string | null
): Promise<WorkspaceLayoutResponse> {
  const { data } = await axios.get(`${API_BASE_URL}/workspace/layout`, {
    headers: getAuthHeader(),
    params: {
      workspace_profile: profile,
      persona_key: personaKey || undefined,
    },
  });
  return {
    ...data,
    layout: normalizeLayout(data.layout),
  } as WorkspaceLayoutResponse;
}

export async function saveWorkspaceLayout(
  profile: WorkspaceProfile,
  layout: DashboardLayoutV2,
  personaKey?: string | null
): Promise<WorkspaceLayoutResponse> {
  const { data } = await axios.put(
    `${API_BASE_URL}/workspace/layout`,
    {
      workspace_profile: profile,
      persona_key: personaKey || '',
      layout,
    },
    { headers: getAuthHeader() }
  );
  return {
    ...data,
    layout: normalizeLayout(data.layout),
  } as WorkspaceLayoutResponse;
}

export async function resetWorkspaceLayout(
  profile: WorkspaceProfile,
  personaKey?: string | null
): Promise<WorkspaceLayoutResponse> {
  const { data } = await axios.delete(`${API_BASE_URL}/workspace/layout`, {
    headers: getAuthHeader(),
    params: {
      workspace_profile: profile,
      persona_key: personaKey || undefined,
    },
  });
  return {
    ...data,
    layout: normalizeLayout(data.layout),
  } as WorkspaceLayoutResponse;
}

export const EDIT_MODE_EVENT = 'ww360-dashboard-edit-mode';
export const LAYOUT_SAVED_EVENT = 'ww360-workspace-layout-saved';

export function requestEnterEditMode(): void {
  window.dispatchEvent(new CustomEvent(EDIT_MODE_EVENT, { detail: { edit: true } }));
}
