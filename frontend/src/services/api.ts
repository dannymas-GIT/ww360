import { getAuthHeader } from '@/services/authService';
import { ProcessedReading } from '@/types'; // Add ReadingItem
import { preferredDisplayUnit, toDisplayConcentration } from '@/utils/units';

// Base URL for the backend API - Use the proxy defined in vite.config.ts
const API_BASE_URL = '/api/v1'; // Updated to use consistent v1 path

/**
 * Fetches water quality readings from the backend API.
 */
export const fetchWaterReadings = async (
  includeInactive: boolean = false,
  includeSpecialLabProjects: boolean = false
): Promise<ProcessedReading[]> => {
  try {
    console.log('🔍 Fetching water readings...');

    // Fetch readings data (page through results to ensure multi-point time series)
    // Use tenant endpoint which includes all necessary fields including qualifier
    const pageSize = 5000;
    const maxPages = 5; // hard cap to avoid unbounded requests (25k rows)
    let skip = 0;
    let allRows: ProcessedReading[] = [];
    for (let page = 0; page < maxPages; page++) {
      const url = `${API_BASE_URL}/tenant/readings?limit=${pageSize}&skip=${skip}&include_inactive=${includeInactive}&include_specials=${includeSpecialLabProjects}`;
      const resp = await fetch(url, {
        headers: {
          ...getAuthHeader(),
        },
        credentials: 'include',
      });

      if (!resp.ok) {
        // Try to get error details from backend response if available
        let errorDetail = `HTTP error! status: ${resp.status}`;
        try {
          const errorData = await resp.json();
          errorDetail = errorData.detail || errorDetail;
          if (resp.status === 401 && errorDetail.includes('Invalid authentication credentials')) {
            console.warn('Authentication token expired, redirecting to login...');
            window.location.href = '/login';
            return [];
          }
        } catch {
          /* token refresh failed, will throw below */
        }
        console.error(`❌ API Error: ${errorDetail}`);
        throw new Error(errorDetail);
      }

      const response = await resp.json();
      // Handle tenant endpoint response format {readings: [...]}
      const rows = Array.isArray(response) ? response : response.readings || [];
      if (!Array.isArray(rows)) break;
      allRows = allRows.concat(rows);
      console.log(`📥 Page ${page + 1}: fetched ${rows.length} readings (total ${allRows.length})`);
      if (rows.length < pageSize) break; // last page
      skip += pageSize;
    }

    const readingsData = allRows;
    console.log(`✅ Fetched ${readingsData.length} raw readings from API (paged)`);
    if (readingsData.length > 0) {
      console.log('📊 Sample raw reading:', readingsData[0]);
    }

    // Also fetch wells data to validate well references
    // TEMPORARILY DISABLED: Backend has database errors with district security service
    // const wellsResponse = await fetch(`${API_BASE_URL}/wells/`, {
    //   headers: {
    //     ...getAuthHeader()
    //   },
    //   credentials: 'include'
    // });

    const validWellIds = new Set<number>();
    // TEMPORARILY ALLOWING ALL WELLS due to backend issues
    console.log('⚠️ Well validation temporarily disabled due to backend database errors');

    // if (wellsResponse.ok) {
    //   const wellsData = await wellsResponse.json();
    //   // Handle both array and object responses
    //   const wells = Array.isArray(wellsData) ? wellsData : (wellsData.wells || []);
    //   validWellIds = new Set(wells.map((well: any) => well.id));
    //   console.log(`✅ Valid well IDs (${validWellIds.size}):`, Array.from(validWellIds).join(', '));
    // } else {
    //   console.warn('⚠️ Could not fetch wells data for validation - allowing all wells');
    //   // Don't filter by wells if we can't fetch well data
    //   validWellIds = new Set();
    // }

    // Process and validate readings data
    const processedReadings: ProcessedReading[] = readingsData
      .filter((reading: any) => {
        // Only filter by wells if we have valid well data
        if (validWellIds.size > 0 && !validWellIds.has(reading.well_id)) {
          console.warn(`🚫 Filtered out reading from non-existent well ID: ${reading.well_id}`);
          return false;
        }
        return true;
      })
      .map((reading: any) => {
        const contaminant = reading.contaminant_name;
        const rawUnit = reading.unit;
        // Normalize PFAS ug/L (Mansfield XLSX) → ng/L at fetch so every dashboard
        // chart path plots on the same scale as historical CSV/PDF ng/L readings.
        const displayValue =
          reading.result_value == null
            ? reading.result_value
            : (toDisplayConcentration(reading.result_value, rawUnit, contaminant) ??
              reading.result_value);
        const displayDl =
          reading.detection_limit == null
            ? reading.detection_limit
            : (toDisplayConcentration(reading.detection_limit, rawUnit, contaminant) ??
              reading.detection_limit);
        const displayUnit =
          reading.result_value != null || reading.detection_limit != null
            ? preferredDisplayUnit(contaminant) || rawUnit
            : rawUnit;

        return {
          id: reading.id,
          timestamp: new Date(reading.sample_date),
          wellId: reading.well_id,
          wellName: reading.well_name || (reading.well && reading.well.name) || undefined,
          contaminant,
          value: displayValue,
          unit: displayUnit,
          mcl: reading.mcl_value || undefined,
          mcl_unit: reading.mcl_unit,
          qualifier: reading.qualifier || undefined,
          detection_limit: displayDl || undefined,
          project_code: reading.project_code ?? undefined,
          lab_project_is_special: Boolean(reading.lab_project_is_special),
          exclude_from_reports: Boolean(reading.exclude_from_reports),
        };
      })
      .filter((reading: ProcessedReading) => {
        // Additional validation - ensure essential fields are present
        // Allow NULL values for ND readings if they have a qualifier or detection_limit
        const hasValue = reading.value !== null && reading.value !== undefined;
        const isNonDetect = reading.qualifier || reading.detection_limit !== null;
        const isValid =
          reading.contaminant &&
          (hasValue || isNonDetect) && // Allow ND readings with qualifier/detection_limit
          reading.wellId &&
          reading.timestamp;

        if (!isValid) {
          console.warn('🚫 Filtered out invalid reading:', {
            contaminant: reading.contaminant,
            value: reading.value,
            qualifier: reading.qualifier,
            detection_limit: reading.detection_limit,
            wellId: reading.wellId,
            timestamp: reading.timestamp,
          });
        }

        return isValid;
      });

    console.log(
      `✅ Processed ${processedReadings.length} valid readings (filtered from ${readingsData.length} raw readings)`
    );

    if (processedReadings.length === 0) {
      console.error('❌ NO VALID READINGS FOUND! Check data format and filtering logic.');
      console.log('📊 Raw data sample for debugging:', readingsData.slice(0, 3));
    }

    return processedReadings;
  } catch (error) {
    console.error('❌ Error in fetchWaterReadings:', error);
    throw error;
  }
};

// Implement API calls for settings
export const fetchThresholdSettings = async (): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/thresholds`, {
      headers: {
        ...getAuthHeader(),
      },
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  } catch (error) {
    console.error('Error fetching threshold settings:', error);
    return { thresholds: [] }; // Return default value to prevent component crashes
  }
};

export const updateThresholdSettings = async (settings: any): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/thresholds`, {
      method: 'POST', // or PUT
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(settings),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  } catch (error) {
    console.error('Error updating threshold settings:', error);
    throw error; // Re-throw this one since it's a user action
  }
};

// Add dashboard summary API function
export const fetchDashboardSummary = async (): Promise<{
  totalReadings: number;
  mclExceedances: number;
  monitoredAnalytes: number;
  wellsMonitored: number;
  recentReadings: number;
}> => {
  try {
    console.log('Fetching dashboard summary...');

    // Fetch alerts statistics from the alerts endpoint (not analytics)
    const alertsResponse = await fetch(`${API_BASE_URL}/alerts/stats/summary`, {
      headers: {
        ...getAuthHeader(),
      },
      credentials: 'include',
    });

    // Fetch analytics statistics for other metrics
    const analyticsResponse = await fetch(`${API_BASE_URL}/analytics/stats/exceedance`, {
      headers: {
        ...getAuthHeader(),
      },
      credentials: 'include',
    });

    if (!alertsResponse.ok || !analyticsResponse.ok) {
      throw new Error(
        `Failed to fetch dashboard summary: alerts=${alertsResponse.status}, analytics=${analyticsResponse.status}`
      );
    }

    const alertsData = await alertsResponse.json();
    const analyticsData = await analyticsResponse.json();

    // Return normalized dashboard summary using alerts for alert counts
    return {
      totalReadings: analyticsData.total_readings || 0,
      mclExceedances: alertsData.total || 0, // Use actual alerts count, not exceeding readings
      monitoredAnalytes: analyticsData.total_analytes || 0,
      wellsMonitored: analyticsData.wells_monitored || 0,
      recentReadings: analyticsData.recent_readings || 0,
    };
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    // Return zeros instead of mock data to prevent misleading information
    return {
      totalReadings: 0,
      mclExceedances: 0,
      monitoredAnalytes: 0,
      wellsMonitored: 0,
      recentReadings: 0,
    };
  }
};
