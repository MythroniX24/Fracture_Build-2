import express from 'express';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomPlayer {
  id: string;
  ws: WebSocket;
  name: string;
  role: 'host' | 'guest';
  characterId: 'volt' | 'rift';
  ready: boolean;
  lastUpdate: number;
}

interface MultiplayerRoom {
  code: string;
  arenaId: 'iron_fortress' | 'overgrown_colossus';
  roundsToWin: number;
  roundTimeSeconds: number;
  status: 'lobby' | 'playing' | 'finished';
  players: Map<string, RoomPlayer>;
  createdAt: number;
}

const rooms = new Map<string, MultiplayerRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoomState(room: MultiplayerRoom) {
  const playerList = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    characterId: p.characterId,
    ready: p.ready,
  }));

  const message = {
    type: 'room_state',
    code: room.code,
    arenaId: room.arenaId,
    roundsToWin: room.roundsToWin,
    roundTimeSeconds: room.roundTimeSeconds,
    status: room.status,
    players: playerList,
  };

  for (const player of room.players.values()) {
    sendJson(player.ws, message);
  }
}

function isValidNumber(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use('/footsteps', express.static(path.join(__dirname, 'footsteps')));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
      timestamp: Date.now(),
    });
  });

  app.get('/api/rooms', (_req, res) => {
    const openRooms = Array.from(rooms.values())
      .filter((r) => r.status === 'lobby' && r.players.size < 2)
      .map((r) => ({
        code: r.code,
        arenaId: r.arenaId,
        hostName: Array.from(r.players.values())[0]?.name || 'Host',
        hostCharacter: Array.from(r.players.values())[0]?.characterId || 'volt',
      }));
    res.json({ rooms: openRooms });
  });

  // WebSocket Server for real-time multiplayer combat & lobby management
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomCode: string | null = null;
    const playerId = `p_${Math.random().toString(36).slice(2, 10)}`;

    sendJson(ws, { type: 'connected', playerId });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendJson(ws, { type: 'error', message: 'Malformed JSON message.' });
        return;
      }

      const type = msg.type;
      if (typeof type !== 'string') return;

      if (type === 'ping') {
        sendJson(ws, { type: 'pong', clientTime: msg.clientTime, serverTime: Date.now() });
        return;
      }

      if (type === 'host_room') {
        // Leave existing room if any
        if (currentRoomCode) {
          handleDisconnect(currentRoomCode, playerId);
        }
        const code = generateRoomCode();
        const characterId = msg.characterId === 'rift' ? 'rift' : 'volt';
        const arenaId = msg.arenaId === 'overgrown_colossus' ? 'overgrown_colossus' : 'iron_fortress';
        const name = typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 18) : 'Vanguard-01';

        const room: MultiplayerRoom = {
          code,
          arenaId,
          roundsToWin: 2,
          roundTimeSeconds: 90,
          status: 'lobby',
          players: new Map(),
          createdAt: Date.now(),
        };

        room.players.set(playerId, {
          id: playerId,
          ws,
          name,
          role: 'host',
          characterId,
          ready: true,
          lastUpdate: Date.now(),
        });

        rooms.set(code, room);
        currentRoomCode = code;
        broadcastRoomState(room);
        return;
      }

      if (type === 'join_room') {
        const rawCode = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
        const room = rooms.get(rawCode);
        if (!room) {
          sendJson(ws, { type: 'error', message: `Room "${rawCode}" was not found.` });
          return;
        }
        if (room.players.size >= 2 && !room.players.has(playerId)) {
          sendJson(ws, { type: 'error', message: `Room "${rawCode}" is already full.` });
          return;
        }

        if (currentRoomCode && currentRoomCode !== rawCode) {
          handleDisconnect(currentRoomCode, playerId);
        }

        const characterId = msg.characterId === 'volt' ? 'volt' : 'rift';
        const name = typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 18) : 'Challenger-02';

        room.players.set(playerId, {
          id: playerId,
          ws,
          name,
          role: 'guest',
          characterId,
          ready: true,
          lastUpdate: Date.now(),
        });

        currentRoomCode = rawCode;
        broadcastRoomState(room);
        return;
      }

      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player) return;

      player.lastUpdate = Date.now();

      if (type === 'update_lobby') {
        if (msg.characterId === 'volt' || msg.characterId === 'rift') {
          player.characterId = msg.characterId;
        }
        if (typeof msg.ready === 'boolean') {
          player.ready = msg.ready;
        }
        if (player.role === 'host') {
          if (msg.arenaId === 'iron_fortress' || msg.arenaId === 'overgrown_colossus') {
            room.arenaId = msg.arenaId;
          }
          if (msg.roundsToWin === 1 || msg.roundsToWin === 2 || msg.roundsToWin === 3) {
            room.roundsToWin = msg.roundsToWin;
          }
        }
        broadcastRoomState(room);
        return;
      }

      if (type === 'start_match') {
        if (player.role !== 'host') return;
        if (room.players.size < 2) {
          sendJson(ws, { type: 'error', message: 'Waiting for an opponent to join before starting.' });
          return;
        }
        const allReady = Array.from(room.players.values()).every((p) => p.ready);
        if (!allReady) {
          sendJson(ws, { type: 'error', message: 'Both fighters must be Ready to start the match.' });
          return;
        }
        room.status = 'playing';
        const startPayload = {
          type: 'match_started',
          code: room.code,
          arenaId: room.arenaId,
          roundsToWin: room.roundsToWin,
          roundTimeSeconds: room.roundTimeSeconds,
          players: Array.from(room.players.values()).map((p) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            characterId: p.characterId,
          })),
        };
        for (const p of room.players.values()) {
          sendJson(p.ws, startPayload);
        }
        return;
      }

      if (type === 'fighter_sync') {
        // Basic validation against invalid / out-of-bounds gameplay updates
        const x = msg.x;
        const z = msg.z;
        const vx = msg.vx;
        const vz = msg.vz;
        const facingAngle = msg.facingAngle;
        const hp = msg.hp;
        const stamina = msg.stamina;

        if (
          !isValidNumber(x, -40, 40) ||
          !isValidNumber(z, -40, 40) ||
          !isValidNumber(vx, -50, 50) ||
          !isValidNumber(vz, -50, 50) ||
          !isValidNumber(facingAngle, -Math.PI * 4, Math.PI * 4) ||
          !isValidNumber(hp, 0, 200) ||
          !isValidNumber(stamina, 0, 200)
        ) {
          return; // Reject corrupted or cheated state packets
        }

        const relayPayload = {
          type: 'remote_fighter_sync',
          playerId,
          x,
          z,
          vx,
          vz,
          facingAngle,
          hp,
          stamina,
          actionState: typeof msg.actionState === 'string' ? msg.actionState : 'idle',
          actionTimer: isValidNumber(msg.actionTimer, 0, 10) ? msg.actionTimer : 0,
          abilityCooldown: isValidNumber(msg.abilityCooldown, 0, 30) ? msg.abilityCooldown : 0,
          decoyActive: Boolean(msg.decoyActive),
          decoyX: isValidNumber(msg.decoyX, -40, 40) ? msg.decoyX : 0,
          decoyZ: isValidNumber(msg.decoyZ, -40, 40) ? msg.decoyZ : 0,
          timestamp: Date.now(),
        };

        for (const [otherId, otherPlayer] of room.players.entries()) {
          if (otherId !== playerId) {
            sendJson(otherPlayer.ws, relayPayload);
          }
        }
        return;
      }

      if (type === 'combat_event') {
        // Relay validated combat events (hit, block, parry, round_win, rematch_request)
        const eventKind = typeof msg.eventKind === 'string' ? msg.eventKind : '';
        if (!['attack_hit', 'guard_hit', 'parry', 'ability_trigger', 'round_over', 'rematch_request'].includes(eventKind)) {
          return;
        }
        const damage = isValidNumber(msg.damage, 0, 60) ? msg.damage : 0;
        const knockbackX = isValidNumber(msg.knockbackX, -35, 35) ? msg.knockbackX : 0;
        const knockbackZ = isValidNumber(msg.knockbackZ, -35, 35) ? msg.knockbackZ : 0;

        for (const [otherId, otherPlayer] of room.players.entries()) {
          if (otherId !== playerId) {
            sendJson(otherPlayer.ws, {
              type: 'remote_combat_event',
              playerId,
              eventKind,
              damage,
              knockbackX,
              knockbackZ,
              winnerRole: msg.winnerRole,
            });
          }
        }
        return;
      }

      if (type === 'leave_room') {
        handleDisconnect(currentRoomCode, playerId);
        currentRoomCode = null;
      }
    });

    ws.on('close', () => {
      if (currentRoomCode) {
        handleDisconnect(currentRoomCode, playerId);
        currentRoomCode = null;
      }
    });
  });

  function handleDisconnect(code: string, leavingPlayerId: string) {
    const room = rooms.get(code);
    if (!room) return;
    room.players.delete(leavingPlayerId);

    if (room.players.size === 0) {
      rooms.delete(code);
      return;
    }

    // Promote remaining player to host if host left
    for (const remaining of room.players.values()) {
      remaining.role = 'host';
      remaining.ready = true;
      sendJson(remaining.ws, {
        type: 'opponent_disconnected',
        message: 'Opponent disconnected from the arena. Returning to lobby.',
      });
    }
    room.status = 'lobby';
    broadcastRoomState(room);
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FRACTURE server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
