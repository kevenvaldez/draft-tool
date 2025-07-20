export interface PlayerWithKTC {
  id: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  age?: number;
  years_exp?: number;
  height?: string;
  weight?: string;
  status?: string;
  injury_status?: string;
  ktc_value?: number;
  ktc_rank?: number;
  updated_at?: Date;
}

export interface DraftConnection {
  leagueId: string;
  draftId: string;
  userId: string;
}

export interface DraftRecommendation {
  player: PlayerWithKTC;
  reason: string;
  valueScore: number;
}

export interface MockDraftState {
  id: string;
  settings: {
    rounds: number;
    teams: number;
    format: 'superflex' | '1qb';
  };
  picks: Array<{
    round: number;
    pick: number;
    playerId?: string;
    teamId: string;
  }>;
  currentPick: number;
}

export interface FilterState {
  position: string;
  team: string;
  search: string;
  availableOnly: boolean;
}
