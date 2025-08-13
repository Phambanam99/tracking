import { create } from 'zustand';

export type Port = {
  id: number;
  city: string;
  state?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
};

interface PortsState {
  ports: Port[];
  showPorts: boolean;
  setPorts: (ports: Port[]) => void;
  toggleShowPorts: () => void;
  setShowPorts: (visible: boolean) => void;
}

export const usePortsStore = create<PortsState>()((set) => ({
  ports: [],
  showPorts: false,
  setPorts: (ports) => set({ ports }),
  toggleShowPorts: () => set((s) => ({ showPorts: !s.showPorts })),
  setShowPorts: (visible) => set({ showPorts: visible }),
}));
