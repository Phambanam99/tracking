// WebSocket base URL normalization
// Accept absolute (ws:// / wss:// / http(s)://) or relative path via NEXT_PUBLIC_WS_URL.
// Fallback to current origin.
function buildWsUrl() {
  const raw = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (!raw) return 'http://localhost:3001';
  // If absolute (starts with ws://, wss://, http://, https://) return as-is after trimming trailing slash
  if (/^(ws|wss|http|https):\/\//i.test(raw)) {
    return raw.replace(/\/$/, '');
  }
  // If relative, use current origin
  return 'http://localhost:3001';
}

const NAMESPACE = '/tracking'; // Socket.IO namespace from backend

type Listener<T = any> = (data: T) => void;

export const websocketService = {
  socket: null as any,
  connectPromise: null as Promise<void> | null,
  hasSubscribedViewport: false,

  // Pending listeners to register once socket is ready
  aircraftListeners: [] as Listener[],
  vesselListeners: [] as Listener[],
  regionAlertListeners: [] as Listener[],
  configListeners: [] as Listener[],

  /**
   * Connect with retry logic and proper error handling
   */
  async connect() {
    if (typeof window === 'undefined') return; // SSR protection
    
    // If already connected, return
    if (this.socket?.connected) {
      return;
    }

    // If connecting, wait for the existing promise
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // Create new connection promise
    this.connectPromise = new Promise<void>((resolve, reject) => {
      // Dynamically import socket.io-client only on client side
      import('socket.io-client')
        .then(({ io }) => {
          const WS_URL = buildWsUrl();
          
          console.log('[WebSocket] Attempting connection to:', `${WS_URL}${NAMESPACE}`);
          console.log('[WebSocket] Configuration:', {
            url: `${WS_URL}${NAMESPACE}`,
            transports: ['polling', 'websocket'], // Try polling first (HTTP long-polling)
            withCredentials: true,
            reconnectionAttempts: 10,
          });
          
          this.socket = io(`${WS_URL}${NAMESPACE}`, {
            transports: ['polling', 'websocket'], // Polling first, then WebSocket upgrade
            withCredentials: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            reconnectionAttempts: 10,
            autoConnect: true,
            path: '/socket.io/',
            auth: {
              // Send token if available - handle case where no token exists
              token: typeof window !== 'undefined' ? localStorage.getItem('token') || null : null,
            },
          });

          const connectTimeout = setTimeout(() => {
            console.warn('[WebSocket] Connection timeout after 15s');
            reject(new Error('WebSocket connection timeout'));
          }, 15000);

          this.socket.once('connect', () => {
            clearTimeout(connectTimeout);
            const transport = this.socket.io.engine.transport.name;
            console.log(`[WebSocket] ✅ Connected successfully via ${transport}`);
            
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
            
            resolve();
          });

          this.socket.on('disconnect', (reason: string) => {
            console.warn('[WebSocket] Disconnected:', reason);
            this.hasSubscribedViewport = false;
          });

          // Log transport upgrades/changes
          this.socket.on('upgrade', (transport: string) => {
            console.log('[WebSocket] Transport upgraded to:', transport);
          });

          this.socket.io.engine.on('upgrade', (transport: any) => {
            console.log('[WebSocket] Engine upgraded to:', transport.name);
          });

          this.socket.on('connect_error', (error: any) => {
            clearTimeout(connectTimeout);
            console.error('[WebSocket] Connection error:', error?.message || error);
            console.error('[WebSocket] Error details:', {
              message: error?.message,
              code: error?.code,
              type: error?.type,
              data: error?.data,
            });
            
            // Retry logic with exponential backoff
            const retryCount = this.socket?._reconnectionAttempts || 0;
            if (retryCount < 5) {
              console.warn(`[WebSocket] Retrying connection (attempt ${retryCount + 1}/5)`);
            setTimeout(() => {
              this.socket?.connect();
            }, Math.min(1000 * Math.pow(2, retryCount), 30000));
            } else {
              console.error('[WebSocket] Max retry attempts reached');
            }
            reject(error);
          });

          this.socket.on('error', (error: any) => {
            console.error('[WebSocket] Socket error:', error?.message || error);
            console.error('[WebSocket] Error details:', {
              message: error?.message,
              code: error?.code,
              type: typeof error,
            });
          });
        })
        .catch((err) => {
          console.error('[WebSocket] Import error:', err);
          reject(err);
        });
    }).finally(() => {
      // Clear the promise after attempt completes
      this.connectPromise = null;
    });

    return this.connectPromise;
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.hasSubscribedViewport = false;
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
    console.log('[WebSocket] 📍 Subscribing viewport:', bbox);
    this.socket.emit('subscribeViewport', { bbox });
    this.hasSubscribedViewport = true;
  },

  updateViewport(bbox: [number, number, number, number]) {
    if (!this.socket) return;
    // Nếu chưa subscribe lần đầu, dùng subscribeViewport
    if (!this.hasSubscribedViewport) {
      console.log('[WebSocket] 📍 First viewport update, calling subscribeViewport');
      this.subscribeViewport(bbox);
    } else {
      console.log('[WebSocket] 📍 Updating viewport:', bbox);
      this.socket.emit('updateViewport', { bbox });
    }
  },
};
