import { 
  leagues, drafts, players, draft_picks, mock_drafts, watchlists, sessions,
  type League, type InsertLeague, type Draft, type InsertDraft,
  type Player, type InsertPlayer, type DraftPick, type InsertDraftPick,
  type MockDraft, type InsertMockDraft, type Watchlist, type InsertWatchlist,
  type Session, type InsertSession
} from "@shared/schema";

export interface IStorage {
  // League operations
  getLeague(id: string): Promise<League | undefined>;
  createLeague(league: InsertLeague): Promise<League>;
  updateLeague(id: string, updates: Partial<InsertLeague>): Promise<League | undefined>;

  // Draft operations
  getDraft(id: string): Promise<Draft | undefined>;
  getDraftsByLeague(leagueId: string): Promise<Draft[]>;
  createDraft(draft: InsertDraft): Promise<Draft>;
  updateDraft(id: string, updates: Partial<InsertDraft>): Promise<Draft | undefined>;

  // Player operations
  getPlayer(id: string): Promise<Player | undefined>;
  getAllPlayers(): Promise<Player[]>;
  getPlayersByPosition(position: string): Promise<Player[]>;
  getPlayersByTeam(team: string): Promise<Player[]>;
  searchPlayers(query: string): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, updates: Partial<InsertPlayer>): Promise<Player | undefined>;
  upsertPlayer(player: InsertPlayer): Promise<Player>;
  bulkUpdatePlayers(players: Player[]): Promise<void>;
  clearAllPlayers(): Promise<void>;

  // Draft pick operations
  getDraftPick(id: number): Promise<DraftPick | undefined>;
  getDraftPicks(draftId: string): Promise<DraftPick[]>;
  createDraftPick(pick: InsertDraftPick): Promise<DraftPick>;
  updateDraftPick(id: number, updates: Partial<InsertDraftPick>): Promise<DraftPick | undefined>;

  // Mock draft operations
  getMockDraft(id: string): Promise<MockDraft | undefined>;
  getMockDraftsByUser(userId: string): Promise<MockDraft[]>;
  createMockDraft(mockDraft: InsertMockDraft): Promise<MockDraft>;
  updateMockDraft(id: string, updates: Partial<InsertMockDraft>): Promise<MockDraft | undefined>;
  deleteMockDraft(id: string): Promise<boolean>;

  // Watchlist operations
  getWatchlist(userId: string): Promise<Watchlist[]>;
  addToWatchlist(item: InsertWatchlist): Promise<Watchlist>;
  removeFromWatchlist(id: number): Promise<boolean>;

  // Session operations
  getSessions(): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  updateSessionLastUsed(id: number): Promise<Session | undefined>;
  deleteSession(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private leagues: Map<string, League>;
  private drafts: Map<string, Draft>;
  private players: Map<string, Player>;
  private draftPicks: Map<number, DraftPick>;
  private mockDrafts: Map<string, MockDraft>;
  private watchlists: Map<number, Watchlist>;
  private sessions: Map<number, Session>;
  private draftPickId: number;
  private watchlistId: number;
  private sessionId: number;

  constructor() {
    this.leagues = new Map();
    this.drafts = new Map();
    this.players = new Map();
    this.draftPicks = new Map();
    this.mockDrafts = new Map();
    this.watchlists = new Map();
    this.sessions = new Map();
    this.draftPickId = 1;
    this.watchlistId = 1;
    this.sessionId = 1;
  }

  async getLeague(id: string): Promise<League | undefined> {
    return this.leagues.get(id);
  }

  async createLeague(insertLeague: InsertLeague): Promise<League> {
    const league: League = {
      ...insertLeague,
      settings: insertLeague.settings ?? null,
      created_at: new Date(),
    };
    this.leagues.set(league.id, league);
    return league;
  }

  async updateLeague(id: string, updates: Partial<InsertLeague>): Promise<League | undefined> {
    const existing = this.leagues.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.leagues.set(id, updated);
    return updated;
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    return this.drafts.get(id);
  }

  async getDraftsByLeague(leagueId: string): Promise<Draft[]> {
    return Array.from(this.drafts.values()).filter(draft => draft.league_id === leagueId);
  }

  async createDraft(insertDraft: InsertDraft): Promise<Draft> {
    const draft: Draft = {
      ...insertDraft,
      settings: insertDraft.settings ?? null,
      start_time: insertDraft.start_time ?? null,
      created_at: new Date(),
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  async updateDraft(id: string, updates: Partial<InsertDraft>): Promise<Draft | undefined> {
    const existing = this.drafts.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.drafts.set(id, updated);
    return updated;
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getAllPlayers(): Promise<Player[]> {
    return Array.from(this.players.values());
  }

  async getPlayersByPosition(position: string): Promise<Player[]> {
    return Array.from(this.players.values()).filter(player => player.position === position);
  }

  async getPlayersByTeam(team: string): Promise<Player[]> {
    return Array.from(this.players.values()).filter(player => player.team === team);
  }

  async searchPlayers(query: string): Promise<Player[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.players.values()).filter(player => 
      player.first_name?.toLowerCase().includes(lowercaseQuery) ||
      player.last_name?.toLowerCase().includes(lowercaseQuery) ||
      player.team?.toLowerCase().includes(lowercaseQuery) ||
      player.position?.toLowerCase().includes(lowercaseQuery)
    );
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    // Check if player already exists
    if (this.players.has(insertPlayer.id)) {
      throw new Error(`Player with id ${insertPlayer.id} already exists`);
    }
    
    const player: Player = {
      ...insertPlayer,
      first_name: insertPlayer.first_name ?? null,
      last_name: insertPlayer.last_name ?? null,
      position: insertPlayer.position ?? null,
      team: insertPlayer.team ?? null,
      age: insertPlayer.age ?? null,
      years_exp: insertPlayer.years_exp ?? null,
      height: insertPlayer.height ?? null,
      weight: insertPlayer.weight ?? null,
      status: insertPlayer.status ?? null,
      injury_status: insertPlayer.injury_status ?? null,
      ktc_value: insertPlayer.ktc_value ?? null,
      ktc_rank: insertPlayer.ktc_rank ?? null,
      updated_at: new Date(),
    };
    this.players.set(player.id, player);
    return player;
  }

  async upsertPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const existing = this.players.get(insertPlayer.id);
    if (existing) {
      const updated = await this.updatePlayer(insertPlayer.id, insertPlayer);
      return updated || existing;
    }
    return this.createPlayer(insertPlayer);
  }

  async updatePlayer(id: string, updates: Partial<InsertPlayer>): Promise<Player | undefined> {
    const existing = this.players.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates, updated_at: new Date() };
    this.players.set(id, updated);
    return updated;
  }

  async bulkUpdatePlayers(players: Player[]): Promise<void> {
    for (const player of players) {
      this.players.set(player.id, { ...player, updated_at: new Date() });
    }
  }

  async clearAllPlayers(): Promise<void> {
    this.players.clear();
  }

  async getDraftPick(id: number): Promise<DraftPick | undefined> {
    return this.draftPicks.get(id);
  }

  async getDraftPicks(draftId: string): Promise<DraftPick[]> {
    return Array.from(this.draftPicks.values())
      .filter(pick => pick.draft_id === draftId)
      .sort((a, b) => a.pick_no - b.pick_no);
  }

  async createDraftPick(insertPick: InsertDraftPick): Promise<DraftPick> {
    const id = this.draftPickId++;
    const pick: DraftPick = {
      ...insertPick,
      id,
      player_id: insertPick.player_id ?? null,
      picked_by: insertPick.picked_by ?? null,
      roster_id: insertPick.roster_id ?? null,
      is_keeper: insertPick.is_keeper ?? null,
      metadata: insertPick.metadata ?? null,
      picked_at: insertPick.player_id ? new Date() : null,
    };
    this.draftPicks.set(id, pick);
    return pick;
  }

  async updateDraftPick(id: number, updates: Partial<InsertDraftPick>): Promise<DraftPick | undefined> {
    const existing = this.draftPicks.get(id);
    if (!existing) return undefined;
    
    const updated = { 
      ...existing, 
      ...updates,
      picked_at: updates.player_id ? new Date() : existing.picked_at
    };
    this.draftPicks.set(id, updated);
    return updated;
  }

  async getMockDraft(id: string): Promise<MockDraft | undefined> {
    return this.mockDrafts.get(id);
  }

  async getMockDraftsByUser(userId: string): Promise<MockDraft[]> {
    return Array.from(this.mockDrafts.values()).filter(draft => draft.user_id === userId);
  }

  async createMockDraft(insertMockDraft: InsertMockDraft): Promise<MockDraft> {
    const mockDraft: MockDraft = {
      ...insertMockDraft,
      current_pick: insertMockDraft.current_pick ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.mockDrafts.set(mockDraft.id, mockDraft);
    return mockDraft;
  }

  async updateMockDraft(id: string, updates: Partial<InsertMockDraft>): Promise<MockDraft | undefined> {
    const existing = this.mockDrafts.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates, updated_at: new Date() };
    this.mockDrafts.set(id, updated);
    return updated;
  }

  async deleteMockDraft(id: string): Promise<boolean> {
    return this.mockDrafts.delete(id);
  }

  async getWatchlist(userId: string): Promise<Watchlist[]> {
    return Array.from(this.watchlists.values()).filter(item => item.user_id === userId);
  }

  async addToWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const id = this.watchlistId++;
    const item: Watchlist = {
      ...insertWatchlist,
      id,
      notes: insertWatchlist.notes ?? null,
      created_at: new Date(),
    };
    this.watchlists.set(id, item);
    return item;
  }

  async removeFromWatchlist(id: number): Promise<boolean> {
    return this.watchlists.delete(id);
  }

  // Session operations
  async getSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).sort((a, b) => 
      new Date(b.last_used).getTime() - new Date(a.last_used).getTime()
    );
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    // Check if session already exists for this combination
    const existingSession = Array.from(this.sessions.values()).find(s => 
      s.league_id === insertSession.league_id && 
      s.draft_id === insertSession.draft_id && 
      s.user_id === insertSession.user_id
    );

    if (existingSession) {
      // Update last_used for existing session
      existingSession.last_used = new Date();
      this.sessions.set(existingSession.id, existingSession);
      return existingSession;
    }

    const id = this.sessionId++;
    const session: Session = {
      ...insertSession,
      id,
      last_used: new Date(),
      created_at: new Date(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSessionLastUsed(id: number): Promise<Session | undefined> {
    const existing = this.sessions.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, last_used: new Date() };
    this.sessions.set(id, updated);
    return updated;
  }

  async deleteSession(id: number): Promise<boolean> {
    return this.sessions.delete(id);
  }
}

export const storage = new MemStorage();
