import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/apiClient';

export interface Region {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  boundary: object; // GeoJSON polygon
  regionType: 'POLYGON' | 'CIRCLE';
  centerLat?: number;
  centerLng?: number;
  radius?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegionAlert {
  id: number;
  regionId: number;
  objectType: 'AIRCRAFT' | 'VESSEL';
  objectId: number;
  alertType: 'ENTRY' | 'EXIT';
  latitude: number;
  longitude: number;
  isRead: boolean;
  createdAt: string;
  region: {
    name: string;
  };
}

interface RegionState {
  regions: Region[];
  alerts: RegionAlert[];
  unreadAlertCount: number;
  isLoading: boolean;
  error: string | null;
  drawingMode: boolean;
  selectedRegion: Region | null;

  // Actions
  fetchRegions: () => Promise<void>;
  createRegion: (regionData: Partial<Region>) => Promise<void>;
  updateRegion: (id: number, regionData: Partial<Region>) => Promise<void>;
  deleteRegion: (id: number) => Promise<void>;
  setSelectedRegion: (region: Region | null) => void;
  setDrawingMode: (mode: boolean) => void;

  // Alert actions
  fetchAlerts: (unreadOnly?: boolean) => Promise<void>;
  markAlertAsRead: (alertId: number) => Promise<void>;
  markAllAlertsAsRead: () => Promise<void>;
  addNewAlert: (alert: RegionAlert) => void;

  // Cleanup function
  cleanupRegions: () => void;
}

export const useRegionStore = create<RegionState>()(
  persist(
    (set, get) => ({
      regions: [],
      alerts: [],
      unreadAlertCount: 0,
      isLoading: false,
      error: null,
      drawingMode: false,
      selectedRegion: null,

      fetchRegions: async () => {
        set({ isLoading: true, error: null });
        try {
          const regions = await api.get('/regions');
          set({ regions, isLoading: false });
        } catch (error: any) {
          console.error('Error fetching regions:', error);
          set({
            error:
              error.response?.data?.message || 'Lỗi khi tải danh sách vùng',
            isLoading: false,
          });
        }
      },

      createRegion: async (regionData) => {
        set({ isLoading: true, error: null });
        try {
          const newRegion = await api.post('/regions', regionData);
          console.log('Created region response:', newRegion);

          if (newRegion && newRegion.id) {
            set((state) => ({
              regions: [...(state.regions || []).filter(Boolean), newRegion],
              isLoading: false,
            }));
          } else {
            throw new Error('Invalid region data received from server');
          }
        } catch (error: any) {
          console.error('Error creating region:', error);
          set({
            error: error.response?.data?.message || 'Lỗi khi tạo vùng mới',
            isLoading: false,
          });
          throw error;
        }
      },

      updateRegion: async (id, regionData) => {
        set({ isLoading: true, error: null });
        try {
          const updatedRegion = await api.put(`/regions/${id}`, regionData);
          set((state) => ({
            regions: (state.regions || []).map((r) =>
              r.id === id ? updatedRegion : r,
            ),
            selectedRegion:
              state.selectedRegion?.id === id
                ? updatedRegion
                : state.selectedRegion,
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Lỗi khi cập nhật vùng',
            isLoading: false,
          });
          throw error;
        }
      },

      deleteRegion: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await api.delete(`/regions/${id}`);
          set((state) => ({
            regions: (state.regions || []).filter((r) => r && r.id !== id),
            selectedRegion:
              state.selectedRegion?.id === id ? null : state.selectedRegion,
            isLoading: false,
          }));
        } catch (error: any) {
          console.error('Error deleting region:', error);
          set({
            error: error.response?.data?.message || 'Lỗi khi xóa vùng',
            isLoading: false,
          });
          throw error;
        }
      },

      setSelectedRegion: (region) => {
        set({ selectedRegion: region });
      },

      setDrawingMode: (mode) => {
        set({ drawingMode: mode });
      },

      fetchAlerts: async (unreadOnly = false) => {
        try {
          const alerts = await api.get(
            `/regions/alerts/list?unread=${unreadOnly}`,
          );
          console.log('Alert ', alerts);
          const unreadCount = alerts.filter(
            (alert: RegionAlert) => !alert.isRead,
          ).length;

          set({
            alerts,
            unreadAlertCount: unreadCount,
          });
        } catch (error: any) {
          set({
            error:
              error.response?.data?.message || 'Lỗi khi tải danh sách cảnh báo',
          });
        }
      },

      markAlertAsRead: async (alertId) => {
        try {
          await api.put(`/regions/alerts/${alertId}/read`);
          set((state) => ({
            alerts: state.alerts.map((alert) =>
              alert.id === alertId ? { ...alert, isRead: true } : alert,
            ),
            unreadAlertCount: Math.max(0, state.unreadAlertCount - 1),
          }));
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Lỗi khi đánh dấu đã đọc',
          });
        }
      },

      markAllAlertsAsRead: async () => {
        try {
          await api.put('/regions/alerts/read-all');
          set((state) => ({
            alerts: state.alerts.map((alert) => ({ ...alert, isRead: true })),
            unreadAlertCount: 0,
          }));
        } catch (error: any) {
          set({
            error:
              error.response?.data?.message || 'Lỗi khi đánh dấu tất cả đã đọc',
          });
        }
      },

      addNewAlert: (alert) => {
        set((state) => ({
          alerts: [alert, ...state.alerts],
          unreadAlertCount: state.unreadAlertCount + 1,
        }));
      },

      cleanupRegions: () => {
        set((state) => ({
          regions: (state.regions || []).filter(Boolean),
        }));
      },
    }),
    {
      name: 'region-storage',
      partialize: (state) => ({
        regions: state.regions,
        selectedRegion: state.selectedRegion,
      }),
    },
  ),
);
