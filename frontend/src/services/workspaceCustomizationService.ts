import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';

export interface FoundryModule {
  module_id: string;
  label: string;
  short_label: string;
  description: string;
  kpi_hints: string[];
  category: string;
  default_size: 'full' | 'half';
  profiles: string[];
  icon: string;
}

export interface LayoutItem {
  module_id: string;
  visible: boolean;
  size: 'full' | 'half';
}

export interface WorkspaceLayoutResponse {
  workspace_profile: string;
  persona_key?: string | null;
  layout: LayoutItem[];
  is_default: boolean;
  updated_at?: string | null;
}

export async function fetchModuleFoundry(profile: WorkspaceProfile): Promise<{
  modules: FoundryModule[];
  default_layout: LayoutItem[];
}> {
  const { data } = await axios.get(`${API_BASE_URL}/workspace/modules`, {
    headers: getAuthHeader(),
    params: { workspace_profile: profile },
  });
  return data;
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
  return data as WorkspaceLayoutResponse;
}

export async function saveWorkspaceLayout(
  profile: WorkspaceProfile,
  layout: LayoutItem[],
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
  return data as WorkspaceLayoutResponse;
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
  return data as WorkspaceLayoutResponse;
}
