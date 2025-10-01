import type { Server } from 'http';
import { WebSocketServer } from 'ws';

export function registerWsServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket) => {
    socket.on('message', (_data) => {
      // Placeholder protocol handler; will be expanded in later steps.
      socket.send(JSON.stringify({ t: 'error', code: 'NOT_IMPLEMENTED', msg: 'Protocol not ready' }));
    });
  });
}
