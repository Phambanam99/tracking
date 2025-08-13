// Explicit WS endpoint; do NOT rely on Next.js rewrites for WebSocket
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL?.trim() || 'http://localhost:3000/tracking';

type Listener<T = any> = (data: T) => void;

export const websocketService = {
  socket: null as any,

  // Pending listeners to register once socket is ready
  aircraftListeners: [] as Listener[],
  vesselListeners: [] as Listener[],
  regionAlertListeners: [] as Listener[],
  configListeners: [] as Listener[],

  connect() {
    if (typeof window === 'undefined') return; // SSR protection
    if (this.socket && (this.socket.connected || this.socket.connecting)) {
      return;
    }

    // Dynamically import socket.io-client only on client side
    import('socket.io-client').then(({ io }) => {
      this.socket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
      });

      this.socket.on('connect', () => {
        // Register any queued listeners
        this.aircraftListeners.forEach((cb) =>
          this.socket.on('aircraftPositionUpdate', cb),
        );
        this.vesselListeners.forEach((cb) =>
          this.socket.on('vesselPositionUpdate', cb),
        );
        this.regionAlertListeners.forEach((cb) =>
          this.socket.on('regionAlert', cb),
        );
        this.configListeners.forEach((cb) =>
          this.socket.on('configUpdate', cb),
        );
      });

      this.socket.on('disconnect', () => {});
      this.socket.on('error', (_error: any) => {});
    });
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  },

  onAircraftUpdate(callback: Listener) {
    this.aircraftListeners.push(callback);
    if (this.socket) this.socket.on('aircraftPositionUpdate', callback);
  },

  offAircraftUpdate(callback: Listener) {
    this.aircraftListeners = this.aircraftListeners.filter(
      (cb) => cb !== callback,
    );
    if (this.socket) this.socket.off('aircraftPositionUpdate', callback);
  },

  onVesselUpdate(callback: Listener) {
    this.vesselListeners.push(callback);
    if (this.socket) this.socket.on('vesselPositionUpdate', callback);
  },

  offVesselUpdate(callback: Listener) {
    this.vesselListeners = this.vesselListeners.filter((cb) => cb !== callback);
    if (this.socket) this.socket.off('vesselPositionUpdate', callback);
  },

  onRegionAlert(callback: Listener) {
    this.regionAlertListeners.push(callback);
    if (this.socket) this.socket.on('regionAlert', callback);
  },

  offRegionAlert(callback: Listener) {
    this.regionAlertListeners = this.regionAlertListeners.filter(
      (cb) => cb !== callback,
    );
    if (this.socket) this.socket.off('regionAlert', callback);
  },

  onConfigUpdate(callback: Listener) {
    this.configListeners.push(callback);
    if (this.socket) this.socket.on('configUpdate', callback);
  },

  offConfigUpdate(callback: Listener) {
    this.configListeners = this.configListeners.filter((cb) => cb !== callback);
    if (this.socket) this.socket.off('configUpdate', callback);
  },

  subscribeViewport(bbox: [number, number, number, number]) {
    if (!this.socket) return;
    this.socket.emit('subscribeViewport', { bbox });
  },

  updateViewport(bbox: [number, number, number, number]) {
    if (!this.socket) return;
    this.socket.emit('updateViewport', { bbox });
  },
};
