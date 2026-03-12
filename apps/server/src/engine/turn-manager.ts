import { v4 as uuid } from 'uuid';

export type TurnStrategy = 'free-form' | 'round-robin' | 'moderated' | 'consensus';

export interface TurnState {
  strategyType: TurnStrategy;
  currentTurn: string | null;  // agentId
  turnOrder: string[];         // agent IDs in order
  turnIndex: number;
  round: number;
  maxRounds: number;
  history: TurnEntry[];
}

export interface TurnEntry {
  id: string;
  agentId: string;
  action: 'speak' | 'pass' | 'delegate' | 'propose' | 'vote';
  timestamp: number;
  round: number;
}

export class TurnManager {
  private state: TurnState;

  constructor(agentIds: string[], strategy: TurnStrategy = 'round-robin', maxRounds = 10) {
    this.state = {
      strategyType: strategy,
      currentTurn: strategy === 'free-form' ? null : agentIds[0] ?? null,
      turnOrder: [...agentIds],
      turnIndex: 0,
      round: 0,
      maxRounds,
      history: [],
    };
  }

  get current(): string | null { return this.state.currentTurn; }
  get strategy(): TurnStrategy { return this.state.strategyType; }
  get round(): number { return this.state.round; }
  get isComplete(): boolean { return this.state.round >= this.state.maxRounds; }

  /** Can this agent speak now? */
  canSpeak(agentId: string): boolean {
    switch (this.state.strategyType) {
      case 'free-form':
        return true;
      case 'round-robin':
        return this.state.currentTurn === agentId;
      case 'moderated':
        return this.state.currentTurn === agentId;
      case 'consensus':
        return true; // All can propose/vote
      default:
        return false;
    }
  }

  /** Record that an agent spoke and advance turn */
  recordTurn(agentId: string, action: TurnEntry['action'] = 'speak'): TurnEntry {
    const entry: TurnEntry = {
      id: uuid(),
      agentId,
      action,
      timestamp: Date.now(),
      round: this.state.round,
    };
    this.state.history.push(entry);
    this.advance();
    return entry;
  }

  /** Advance to next turn based on strategy */
  private advance(): void {
    switch (this.state.strategyType) {
      case 'round-robin': {
        this.state.turnIndex = (this.state.turnIndex + 1) % this.state.turnOrder.length;
        this.state.currentTurn = this.state.turnOrder[this.state.turnIndex] ?? null;
        if (this.state.turnIndex === 0) this.state.round++;
        break;
      }
      case 'moderated': {
        // Moderator (first agent) always gets turn back after someone speaks
        const isModerator = this.state.currentTurn === this.state.turnOrder[0];
        if (isModerator) {
          // Moderator picks next — for now just round-robin the rest
          this.state.turnIndex = this.state.turnIndex === 0
            ? 1
            : ((this.state.turnIndex % (this.state.turnOrder.length - 1)) + 1);
        } else {
          this.state.turnIndex = 0; // Back to moderator
          this.state.round++;
        }
        this.state.currentTurn = this.state.turnOrder[this.state.turnIndex] ?? null;
        break;
      }
      case 'consensus': {
        // In consensus, round advances after all agents have spoken
        const agentsThisRound = new Set(
          this.state.history
            .filter(e => e.round === this.state.round)
            .map(e => e.agentId)
        );
        if (agentsThisRound.size >= this.state.turnOrder.length) {
          this.state.round++;
        }
        break;
      }
      case 'free-form':
      default:
        // No turn advancement needed
        break;
    }
  }

  /** Delegate turn to specific agent (for moderated strategy) */
  delegateTo(agentId: string): void {
    if (this.state.turnOrder.includes(agentId)) {
      this.state.currentTurn = agentId;
      this.state.turnIndex = this.state.turnOrder.indexOf(agentId);
    }
  }

  /** Get current state (for serialization/UI) */
  getState(): Readonly<TurnState> {
    return { ...this.state, history: [...this.state.history] };
  }

  /** Reset for new conversation */
  reset(): void {
    this.state.turnIndex = 0;
    this.state.currentTurn = this.state.strategyType === 'free-form'
      ? null
      : this.state.turnOrder[0] ?? null;
    this.state.round = 0;
    this.state.history = [];
  }
}
