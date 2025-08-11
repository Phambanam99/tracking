// Explicit WS endpoint; do NOT rely on Next.js rewrites for WebSocket
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL?.trim() || 'http://localhost:3000/tracking';

export const websocketService = {
  socket: null as any,

  connect() {
    if (typeof window === 'undefined') return; // SSR protection

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
      this.socket.on('aircraft-update', callback);
    }
  },

  onVesselUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('vessel-update', callback);
    }
  },

  offAircraftUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('aircraft-update', callback);
    }
  },

  offVesselUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('vessel-update', callback);
    }
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
