// Base URL for backend API
export const API_BASE_URL = '/api/v1';

// All API Endpoints - Mixed trailing slash usage based on backend requirements
export const API_ENDPOINTS = {
  // Standard endpoints (with trailing slashes for FastAPI default)
  READINGS: '/api/v1/readings/',
  WELLS: '/api/v1/wells/',
  GUIDELINES: '/api/v1/guidelines/',
  ALERTS: '/api/v1/alerts/',
  USERS: '/api/v1/users/',
  AUTH_LOGIN: '/api/v1/auth/login/', // Added for clarity
  USERS_ME: '/api/v1/users/me/', // Added for clarity

  // Analytics endpoints (without trailing slashes)
  ANALYTES: '/api/v1/analytics/analytes', // Corrected path without trailing slash
  ANALYTICS_SUMMARY: '/api/v1/analytics/summary', // Without trailing slash

  // Alert specific endpoints
  ALERTS_STATS_SUMMARY: '/api/v1/alerts/stats/summary', // Alert statistics
  ALERTS_ANALYTICS_RESOLUTIONS: '/api/v1/alerts/analytics/resolutions', // Resolution analytics
  ALERTS_SEARCH_NOTES: '/api/v1/alerts/search/notes', // Search resolution notes
  ALERT_SCHEDULE_LINKAGE: '/api/v1/alert-schedule-linkage', // Alert-schedule linkage endpoints

  // Other special endpoints
  REPORTS: '/api/v1/reports/', // Added for clarity, was part of general /analytics/
};

// Auth token key
export const AUTH_TOKEN_KEY = 'water-dashboard-auth-token';

// Dynamic district configuration
export const getUserDistrict = async (): Promise<string | null> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('No auth token found');
      return null; // Return null for unauthenticated users
    }

    const response = await fetch('/api/v1/tenant/auth/context', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('🏢 User district from API:', data.district_code);
      return data.district_code || null;
    } else {
      console.error('Failed to fetch auth context:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error fetching user district:', error);
  }
  return null; // Return null instead of defaulting to WWD
};

// Synchronous version that uses cached district from localStorage
export const getCachedUserDistrict = (): string | null => {
  try {
    // Try to get from auth context stored in localStorage
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Decode JWT to get district (basic decode, no verification needed for client-side)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const district = payload.district_code || null;
      console.log('🏢 Cached user district from JWT:', district);
      return district;
    }
  } catch (error) {
    console.error('Failed to get cached district:', error);
  }
  return null; // Return null instead of defaulting to WWD
};

// User key
export const USER_KEY = 'water-dashboard-user';

// Default pagination settings
export const DEFAULT_PAGE_SIZE = 25;

// Export analytics types
export enum AnalysisType {
  TIME_SERIES = 'time_series',
  COMPARISON = 'comparison',
  EXCEEDING = 'exceeding',
  TRENDS = 'trends',
}
