import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlayerCard } from "./player-card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Filter, 
  Users, 
  Grid3X3, 
  List, 
  Play, 
  RotateCcw,
  Download,
  Bot,
  Clock,
  Target
} from "lucide-react";
import type { PlayerWithKTC, FilterState } from "@/lib/types";

interface DraftOrderData {
  currentPick: {
    round: number;
    pickInRound: number;
    absolutePick: number;
    totalPicks: number;
  };
  userPicks: Array<{
    round: number;
    pickInRound: number;
    absolutePick: number;
    isNext: boolean;
    picksAway: number;
  }>;
  draftOrder: Record<string, number>;
  settings: {
    rounds: number;
    teams: number;
    type: string;
  };
}

interface DraftBoardProps {
  players: PlayerWithKTC[];
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onPlayerSelect: (player: PlayerWithKTC) => void;
  isLoading: boolean;
  mockDraftMode: boolean;
  onToggleMockDraft: () => void;
  draftedPlayers: Set<string>;
  onDraftPlayer: (playerId: string) => void;
  onResetMockDraft: () => void;
  onSaveMockDraft: () => Promise<void>;
  draftOrder?: DraftOrderData;
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
];

export function DraftBoard({
  players,
  filters,
  onFilterChange,
  onPlayerSelect,
  isLoading,
  mockDraftMode,
  onToggleMockDraft,
  draftedPlayers,
  onDraftPlayer,
  onResetMockDraft,
  onSaveMockDraft,
  draftOrder
}: DraftBoardProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [displayCount, setDisplayCount] = useState(24);

  const filteredPlayers = players.filter(player => {
    if (filters.position && player.position !== filters.position) return false;
    if (filters.team && player.team !== filters.team) return false;
    if (filters.availableOnly && draftedPlayers.has(player.id)) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const fullName = `${player.first_name || ''} ${player.last_name || ''}`.toLowerCase();
      return fullName.includes(searchLower) || 
             player.team?.toLowerCase().includes(searchLower) ||
             player.position?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  const sortedPlayers = filteredPlayers
    .sort((a, b) => {
      const aValue = a.ktc_value || 0;
      const bValue = b.ktc_value || 0;
      return bValue - aValue;
    });

  const displayedPlayers = sortedPlayers.slice(0, displayCount);
  const availableCount = sortedPlayers.filter(p => !draftedPlayers.has(p.id)).length;

  const loadMore = () => {
    setDisplayCount(prev => prev + 24);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Search className="h-5 w-5 text-primary mr-2" />
                Search & Filters
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search Players</Label>
                  <Input
                    id="search"
                    type="text"
                    placeholder="Search players..."
                    value={filters.search}
                    onChange={(e) => onFilterChange({ search: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select 
                    value={filters.position} 
                    onValueChange={(value) => onFilterChange({ position: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="All Positions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Positions</SelectItem>
                      {POSITIONS.map(pos => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Team</Label>
                  <Select 
                    value={filters.team} 
                    onValueChange={(value) => onFilterChange({ team: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="All Teams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      {TEAMS.map(team => (
                        <SelectItem key={team} value={team}>{team}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="availableOnly"
                    checked={filters.availableOnly}
                    onCheckedChange={(checked) => onFilterChange({ availableOnly: checked })}
                  />
                  <Label htmlFor="availableOnly" className="text-sm">Available only</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Draft Order */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Target className="h-5 w-5 text-secondary mr-2" />
                Draft Order
              </h3>
              
              {draftOrder ? (
                <div className="space-y-3">
                  {/* Current Pick */}
                  <div className="bg-accent/20 border border-accent rounded-lg p-3">
                    <div className="text-sm text-accent font-medium mb-1">Current Pick</div>
                    <div className="text-lg font-bold">
                      {draftOrder.currentPick.round}.{draftOrder.currentPick.pickInRound.toString().padStart(2, '0')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Pick {draftOrder.currentPick.absolutePick} of {draftOrder.currentPick.totalPicks}
                    </div>
                  </div>

                  {/* User's Upcoming Picks */}
                  {draftOrder.userPicks.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Your Upcoming Picks</div>
                      <div className="space-y-2">
                        {draftOrder.userPicks.slice(0, 3).map((pick, index) => (
                          <div key={index} className={`flex items-center justify-between p-2 rounded-lg ${
                            pick.isNext ? 'bg-primary/20 border border-primary' : 'bg-muted'
                          }`}>
                            <span className={`text-sm font-medium ${pick.isNext ? 'text-primary' : ''}`}>
                              {pick.round}.{pick.pickInRound.toString().padStart(2, '0')}
                            </span>
                            <span className={`text-sm ${
                              pick.isNext ? 'text-primary' : 'text-muted-foreground'
                            }`}>
                              {pick.isNext ? 'Your Turn' : `${pick.picksAway} pick${pick.picksAway !== 1 ? 's' : ''} away`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-muted animate-pulse rounded-lg p-3 h-16"></div>
                  <div className="bg-muted animate-pulse rounded-lg p-2 h-10"></div>
                  <div className="bg-muted animate-pulse rounded-lg p-2 h-10"></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {/* Player Grid Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Users className="h-5 w-5 text-secondary mr-2" />
                    Available Players
                    <Badge variant="secondary" className="ml-2">
                      {availableCount}
                    </Badge>
                  </h3>
                  {mockDraftMode && (
                    <Badge variant="outline" className="text-accent border-accent">
                      <Play className="h-3 w-3 mr-1" />
                      Mock Draft
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    Grid
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4 mr-1" />
                    List
                  </Button>
                </div>
              </div>

              {/* Player Grid/List */}
              {isLoading ? (
                <div className={`grid ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' 
                    : 'grid-cols-1 gap-2'
                }`}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-xl" />
                  ))}
                </div>
              ) : displayedPlayers.length > 0 ? (
                <>
                  <div className={`grid ${
                    viewMode === 'grid' 
                      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' 
                      : 'grid-cols-1 gap-2'
                  }`}>
                    {displayedPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        onClick={() => onPlayerSelect(player)}
                        onDraft={() => onDraftPlayer(player.id)}
                        isDrafted={draftedPlayers.has(player.id)}
                        mockDraftMode={mockDraftMode}
                      />
                    ))}
                  </div>

                  {displayedPlayers.length < sortedPlayers.length && (
                    <div className="mt-6 text-center">
                      <Button onClick={loadMore} variant="outline">
                        Load More Players ({sortedPlayers.length - displayedPlayers.length} remaining)
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No players match your current filters</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => onFilterChange({ position: '', team: '', search: '' })}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mock Draft Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Play className="h-5 w-5 text-accent mr-2" />
              Mock Draft Controls
            </h3>
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onResetMockDraft}
                disabled={!mockDraftMode || draftedPlayers.size === 0}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button 
                variant={mockDraftMode ? "destructive" : "default"} 
                size="sm"
                onClick={async () => {
                  if (mockDraftMode && draftedPlayers.size > 0) {
                    await onSaveMockDraft();
                  }
                  onToggleMockDraft();
                }}
              >
                {mockDraftMode ? 'End Mock' : 'Start Mock'}
              </Button>
              <Button variant="outline" size="sm">
                <Bot className="h-4 w-4 mr-2" />
                Auto Draft
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-medium text-secondary mb-2">Draft Progress</h4>
              {draftOrder ? (
                <>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="flex-1 bg-border rounded-full h-2">
                      <div 
                        className="bg-secondary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(draftOrder.currentPick.absolutePick / draftOrder.currentPick.totalPicks) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {draftOrder.currentPick.absolutePick - 1}/{draftOrder.currentPick.totalPicks}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Round {draftOrder.currentPick.round}, Pick {draftOrder.currentPick.pickInRound}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="flex-1 bg-border rounded-full h-2">
                      <div 
                        className="bg-secondary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(draftedPlayers.size / 144) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{draftedPlayers.size}/144</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Round 1, Pick {draftedPlayers.size + 1}
                  </p>
                </>
              )}
            </div>
            
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-medium text-accent mb-2">Draft Status</h4>
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-4 w-4 text-accent" />
                <span className="text-lg font-mono">
                  {draftOrder?.settings.type || 'Dynasty'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {draftOrder ? `${draftOrder.settings.teams} teams, ${draftOrder.settings.rounds} rounds` : 'Loading draft info...'}
              </p>
            </div>
            
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-medium text-primary mb-2">Your Next Pick</h4>
              {draftOrder?.userPicks.length > 0 ? (
                <>
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-lg font-semibold">
                      {draftOrder.userPicks[0].round}.{draftOrder.userPicks[0].pickInRound.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {draftOrder.userPicks[0].picksAway === 0 
                      ? 'Your turn now!'
                      : `${draftOrder.userPicks[0].picksAway} pick${draftOrder.userPicks[0].picksAway !== 1 ? 's' : ''} away`}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-lg font-semibold">--</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Loading...</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
