import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';

export interface OwwBlogItem {
  id: number;
  slug: string;
  title: string;
  excerpt?: string | null;
  author_name?: string | null;
  published_at?: string | null;
  tags?: string[];
  cover_image_url?: string | null;
  state_code?: string;
  url?: string;
}

export interface OwwBlogResponse {
  total: number;
  items: OwwBlogItem[];
  state_code: string;
  source: string;
  data_mode: 'live' | 'empty' | 'error';
  message?: string | null;
}

export async function fetchOwwBlog(state = 'NY', limit = 5): Promise<OwwBlogResponse> {
  const { data } = await axios.get(`${API_BASE_URL}/content/oww-blog`, {
    headers: getAuthHeader(),
    params: { state, limit },
  });
  return data as OwwBlogResponse;
}
