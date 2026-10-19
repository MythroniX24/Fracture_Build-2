import { ArenaId, CharacterId } from '../game/config.ts';
import { FighterActionState, FighterInput, SimulationState } from '../game/rules.ts';

export interface LobbyPlayerInfo {
  id: string;
  name: string;
  role: 'host' | 'guest';
  characterId: CharacterId;
  ready: boolean;
}

export interface RoomStatePayload {
  code: string;
  arenaId: ArenaId;
  roundsToWin: number;
  roundTimeSeconds: number;
  status: 'lobby' | 'playing' | 'finished';
  players: LobbyPlayerInfo[];
}

export interface RemoteFighterSyncPayload {
  playerId: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingAngle: number;
  hp: number;
  stamina: number;
  actionState: FighterActionState;
  actionTimer: number;
  abilityCooldown: number;
  decoyActive: boolean;
  decoyX: number;
  decoyZ: number;
  timestamp: number;
}

export interface RemoteCombatEventPayload {
  playerId: string;
  eventKind:
    | 'attack_hit'
    | 'guard_hit'
    | 'parry'
    | 'ability_trigger'
    | 'round_over'
    | 'rematch_request';
  damage: number;
  knockbackX: number;
  knockbackZ: number;
  winnerRole?: 'host' | 'guest' | 'draw';
}

export interface OpenRoomListing {
  code: string;
  arenaId: ArenaId;
  hostName: string;
  hostCharacter: CharacterId;
}

type Listener = () => void;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  public connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' =
    'disconnected';
  public errorMessage: string | null = null;
  public localPlayerId: string | null = null;
  public localRole: 'host' | 'guest' = 'host';
  public currentRoom: RoomStatePayload | null = null;
  public latencyMs = 0;
  public latestGuestInput: FighterInput | null = null;

  private listeners = new Set<Listener>();
  private onMatchStartCallback: ((room: RoomStatePayload) => void) | null = null;
  private onRemoteSyncCallback: ((sync: RemoteFighterSyncPayload) => void) | null = null;
  private onRemoteCombatEventCallback: ((evt: RemoteCombatEventPayload) => void) | null = null;
  private onOpponentDisconnectedCallback: ((msg: string) => void) | null = null;
  private pingInterval: number | null = null;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) {
      l();
    }
  }

  public setCallbacks(callbacks: {
    onMatchStart?: (room: RoomStatePayload) => void;
    onRemoteSync?: (sync: RemoteFighterSyncPayload) => void;
    onRemoteCombatEvent?: (evt: RemoteCombatEventPayload) => void;
    onOpponentDisconnected?: (msg: string) => void;
  }): void {
    this.onMatchStartCallback = callbacks.onMatchStart || null;
    this.onRemoteSyncCallback = callbacks.onRemoteSync || null;
    this.onRemoteCombatEventCallback = callbacks.onRemoteCombatEvent || null;
    this.onOpponentDisconnectedCallback = callbacks.onOpponentDisconnected || null;
  }

  public connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.connectionStatus = 'connecting';
    this.errorMessage = null;
    this.notify();

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.connectionStatus = 'connected';
        this.errorMessage = null;
        this.notify();

        if (this.pingInterval) window.clearInterval(this.pingInterval);
        this.pingInterval = window.setInterval(() => {
          this.send({ type: 'ping', clientTime: Date.now() });
        }, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch {
          // Ignore malformed packet
        }
      };

      ws.onerror = () => {
        this.connectionStatus = 'error';
        this.errorMessage = 'Unable to reach multiplayer signaling server.';
        this.notify();
      };

      ws.onclose = () => {
        this.connectionStatus = 'disconnected';
        this.currentRoom = null;
        if (this.pingInterval) {
          window.clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        this.notify();
      };
    } catch {
      this.connectionStatus = 'error';
      this.errorMessage = 'WebSocket initialization failed.';
      this.notify();
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'connected': {
        this.localPlayerId = String(msg.playerId || '');
        this.notify();
        break;
      }

      case 'pong': {
        if (typeof msg.clientTime === 'number') {
          this.latencyMs = Math.max(1, Date.now() - msg.clientTime);
          this.notify();
        }
        break;
      }

      case 'error': {
        this.errorMessage = String(msg.message || 'Multiplayer error.');
        this.notify();
        break;
      }

      case 'room_state': {
        const players = Array.isArray(msg.players)
          ? (msg.players as LobbyPlayerInfo[])
          : [];
        const self = players.find((p) => p.id === this.localPlayerId);
        if (self) {
          this.localRole = self.role;
        }
        this.currentRoom = {
          code: String(msg.code),
          arenaId: 'foundry_arena',
          roundsToWin: Number(msg.roundsToWin) || 2,
          roundTimeSeconds: Number(msg.roundTimeSeconds) || 90,
          status: (msg.status as 'lobby' | 'playing' | 'finished') || 'lobby',
          players,
        };
        this.errorMessage = null;
        this.notify();
        break;
      }

      case 'match_started': {
        if (this.currentRoom) {
          this.currentRoom.status = 'playing';
          this.notify();
          this.onMatchStartCallback?.(this.currentRoom);
        }
        break;
      }

      case 'guest_input': {
        if (msg.input && typeof msg.input === 'object') {
          this.latestGuestInput = msg.input as FighterInput;
        }
        break;
      }

      case 'remote_fighter_sync': {
        this.onRemoteSyncCallback?.(msg as unknown as RemoteFighterSyncPayload);
        break;
      }

      case 'remote_combat_event': {
        this.onRemoteCombatEventCallback?.(msg as unknown as RemoteCombatEventPayload);
        break;
      }

      case 'opponent_disconnected': {
        const notice = String(msg.message || 'Opponent disconnected.');
        this.errorMessage = notice;
        this.notify();
        this.onOpponentDisconnectedCallback?.(notice);
        break;
      }
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public hostRoom(name: string, characterId: CharacterId, arenaId: ArenaId): void {
    this.localRole = 'host';
    this.connect();
    const attemptSend = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'host_room', name, characterId, arenaId });
      } else {
        window.setTimeout(attemptSend, 100);
      }
    };
    attemptSend();
  }

  public joinRoom(code: string, name: string, characterId: CharacterId): void {
    this.localRole = 'guest';
    this.connect();
    const attemptSend = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'join_room',
          code: code.trim().toUpperCase(),
          name,
          characterId,
        });
      } else {
        window.setTimeout(attemptSend, 100);
      }
    };
    attemptSend();
  }

  public updateLobby(updates: {
    characterId?: CharacterId;
    arenaId?: ArenaId;
    roundsToWin?: number;
    ready?: boolean;
  }): void {
    this.send({ type: 'update_lobby', ...updates });
  }

  public startMatch(): void {
    this.send({ type: 'start_match' });
  }

  public clearGuestOneShots(): void {
    if (this.latestGuestInput) {
      this.latestGuestInput.jumpPressed = false;
      this.latestGuestInput.lightPressed = false;
      this.latestGuestInput.heavyPressed = false;
      this.latestGuestInput.guardJustPressed = false;
      this.latestGuestInput.dodgePressed = false;
      this.latestGuestInput.abilityPressed = false;
      this.latestGuestInput.executionPressed = false;
    }
  }

  public sendGuestInput(input: FighterInput): void {
    this.send({ type: 'guest_input', input });
  }

  public sendHostSnapshot(sim: SimulationState): void {
    this.send({
      type: 'fighter_sync',
      x: sim.p1.x,
      z: sim.p1.z,
      vx: sim.p1.vx,
      vz: sim.p1.vz,
      facingAngle: sim.p1.facingAngle,
      hp: sim.p1.hp,
      stamina: sim.p1.stamina,
      actionState: sim.p1.action,
      actionTimer: sim.p1.actionTimerMs,
      abilityCooldown: sim.p1.abilityCooldownMs,
    });
  }

  public sendFighterSync(
    sync: Omit<RemoteFighterSyncPayload, 'playerId' | 'timestamp'>
  ): void {
    this.send({ type: 'fighter_sync', ...sync });
  }

  public sendCombatEvent(evt: Omit<RemoteCombatEventPayload, 'playerId'>): void {
    this.send({ type: 'combat_event', ...evt });
  }

  public leaveRoom(): void {
    this.send({ type: 'leave_room' });
    this.currentRoom = null;
    this.errorMessage = null;
    this.notify();
  }

  public async fetchOpenRooms(): Promise<OpenRoomListing[]> {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.rooms) ? data.rooms : [];
    } catch {
      return [];
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
