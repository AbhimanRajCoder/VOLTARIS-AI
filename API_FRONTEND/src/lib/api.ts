import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

export const getGridSummary = async () => {
  try {
    const response = await api.get('/forecast/summary');
    return response.data;
  } catch (error) {
    console.error('Error fetching grid summary:', error);
    return [];
  }
};

export const getDemandForecast = async (zoneId: string) => {
  try {
    const response = await api.get(`/forecast/demand?zone_id=${zoneId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching demand forecast:', error);
    return [];
  }
};

export const getHotspots = async (nClusters = 5) => {
  try {
    const response = await api.get(`/infra/hotspots?n_clusters=${nClusters}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching hotspots:', error);
    return null;
  }
};

export const getAlerts = async () => {
  try {
    const response = await api.get('/grid/alerts');
    return response.data;
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }
};

export const getDeflectRouting = async () => {
  try {
    const response = await api.get('/deflect/routing');
    return response.data;
  } catch (error) {
    console.error('Error fetching deflect routing:', error);
    return null;
  }
};

export const postCommunityAlert = async (zoneId?: string) => {
  try {
    const response = await api.post('/deflect/community-alert', zoneId ? { zone_id: zoneId } : {});
    return response.data;
  } catch (error) {
    console.error('Error posting community alert:', error);
    return null;
  }
};

export const getImpactSummary = async () => {
  try {
    const response = await api.get('/deflect/impact-summary');
    return response.data;
  } catch (error) {
    console.error('Error fetching impact summary:', error);
    return null;
  }
};

export const getPartnerStatus = async () => {
  try {
    const response = await api.get('/deflect/partner-status');
    return response.data;
  } catch (error) {
    console.error('Error fetching partner status:', error);
    return null;
  }
};

export default api;
