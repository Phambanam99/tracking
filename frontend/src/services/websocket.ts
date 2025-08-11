// Explicit WS endpoint; do NOT rely on Next.js rewrites for WebSocket
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL?.trim() || 'http://localhost:3000/tracking';

export const websocketService = {
  socket: null as any,

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
        // path defaults to '/socket.io' which matches server
      });

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
      });

      this.socket.on('error', (error: any) => {
        console.error('WebSocket error:', error);
      });
    });
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  },

  onAircraftUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('aircraftPositionUpdate', callback);
    }
  },

  onVesselUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('vesselPositionUpdate', callback);
    }
  },

  offAircraftUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('aircraftPositionUpdate', callback);
    }
  },

  offVesselUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('vesselPositionUpdate', callback);
    }
  },

  subscribeViewport(bbox: [number, number, number, number]) {
    if (!this.socket) return;
    this.socket.emit('subscribeViewport', { bbox });
  },

  updateViewport(bbox: [number, number, number, number]) {
    if (!this.socket) return;
    this.socket.emit('updateViewport', { bbox });
  },

  onRegionAlert(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('regionAlert', callback);
    }
  },

  offRegionAlert(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('regionAlert', callback);
    }
  },
};
