import axios from 'axios';

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  sport: string;
  season: string;
  status: string;
  settings: Record<string, any>;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  total_rosters: number;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  type: string;
  status: string;
  sport: string;
  season: string;
  settings: Record<string, any>;
  start_time: number | null;
  draft_order: Record<string, number> | null;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  height: string | null;
  weight: string | null;
  status: string;
  injury_status: string | null;
  fantasy_positions: string[];
}

export interface SleeperDraftPick {
  draft_id: string;
  player_id: string | null;
  picked_by: string;
  roster_id: number;
  round: number;
  pick_no: number;
  is_keeper: boolean | null;
  metadata: Record<string, any> | null;
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export class SleeperService {
  private async makeRequest<T>(endpoint: string): Promise<T> {
    try {
      const response = await axios.get(`${SLEEPER_BASE_URL}${endpoint}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Dynasty-Draft-Analyzer/1.0'
        }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Sleeper resource not found: ${endpoint}`);
        }
        if (error.response?.status === 429) {
          throw new Error('Sleeper API rate limit exceeded. Please try again later.');
        }
        throw new Error(`Sleeper API error: ${error.response?.statusText || error.message}`);
      }
      throw new Error(`Network error accessing Sleeper API: ${error}`);
    }
  }

  async getUser(userId: string): Promise<SleeperUser> {
    return this.makeRequest<SleeperUser>(`/user/${userId}`);
  }

  async getLeague(leagueId: string): Promise<SleeperLeague> {
    return this.makeRequest<SleeperLeague>(`/league/${leagueId}`);
  }

  async getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
    return this.makeRequest<SleeperUser[]>(`/league/${leagueId}/users`);
  }

  async getLeagueRosters(leagueId: string): Promise<any[]> {
    return this.makeRequest<any[]>(`/league/${leagueId}/rosters`);
  }

  async getLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
    return this.makeRequest<SleeperDraft[]>(`/league/${leagueId}/drafts`);
  }

  async getDraft(draftId: string): Promise<SleeperDraft> {
    return this.makeRequest<SleeperDraft>(`/draft/${draftId}`);
  }

  async getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
    return this.makeRequest<SleeperDraftPick[]>(`/draft/${draftId}/picks`);
  }

  async getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
    return this.makeRequest<Record<string, SleeperPlayer>>('/players/nfl');
  }

  async getTradedPicks(leagueId: string): Promise<SleeperTradedPick[]> {
    return this.makeRequest<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`);
  }

  async getTrendingPlayers(type: 'add' | 'drop', lookbackHours: number = 24, limit: number = 25): Promise<any[]> {
    return this.makeRequest<any[]>(`/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`);
  }

  async validateConnection(leagueId: string, draftId: string, userId: string): Promise<{
    valid: boolean;
    league?: SleeperLeague;
    draft?: SleeperDraft;
    user?: SleeperUser;
    error?: string;
  }> {
    try {
      const [league, draft, user] = await Promise.all([
        this.getLeague(leagueId).catch(() => null),
        this.getDraft(draftId).catch(() => null),
        this.getUser(userId).catch(() => null)
      ]);

      if (!league) {
        return { valid: false, error: 'Invalid league ID' };
      }
      if (!draft) {
        return { valid: false, error: 'Invalid draft ID' };
      }
      if (!user) {
        return { valid: false, error: 'Invalid user ID' };
      }
      if (draft.league_id !== leagueId) {
        return { valid: false, error: 'Draft does not belong to specified league' };
      }

      return { valid: true, league, draft, user };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown validation error' 
      };
    }
  }
}

export const sleeperService = new SleeperService();
