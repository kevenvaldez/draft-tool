import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConnectionPanel } from "@/components/connection-panel";
import { DraftBoard } from "@/components/draft-board";
import { PlayerModal } from "@/components/player-modal";
import { MockDraftHistory } from "@/components/mock-draft-history";
import { DraftSlotTracker } from "@/components/draft-slot-tracker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Volleyball, Settings, Activity, Zap, Trophy, BarChart3, Users, Clock, TrendingUp } from "lucide-react";
import type { DraftConnection, PlayerWithKTC, FilterState } from "@/lib/types";

export default function Home() {
  const [connection, setConnection] = useState<DraftConnection | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithKTC | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    position: "",
    team: "",
    search: "",
    availableOnly: true
  });
  const [mockDraftMode, setMockDraftMode] = useState(false);
  const [draftedPlayers, setDraftedPlayers] = useState<Set<string>>(new Set());
  const [currentMockDraftId, setCurrentMockDraftId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch players with KTC values
  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ["/api/players"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.position) params.append('position', filters.position);
      if (filters.team) params.append('team', filters.team);
      if (filters.search) params.append('search', filters.search);
      if (filters.availableOnly) params.append('availableOnly', 'true');
      
      const response = await fetch(`/api/players?${params}`);
      if (!response.ok) throw new Error('Failed to fetch players');
      return response.json();
    },
    enabled: !!connection,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch KTC rankings
  const { data: ktcRankings, isLoading: ktcLoading } = useQuery({
    queryKey: ["/api/ktc/rankings"],
    enabled: !!connection,
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Connect to Sleeper
  const connectMutation = useMutation({
    mutationFn: async (connectionData: DraftConnection) => {
      const response = await apiRequest("POST", "/api/sleeper/connect", connectionData);
      return response.json();
    },
    onSuccess: (data) => {
      setConnection(data);
      toast({
        title: "Connected successfully!",
        description: `Connected to ${data.league?.name || 'league'} draft`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
    },
    onError: (error) => {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect to Sleeper",
        variant: "destructive",
      });
    },
  });

  // Get draft order information
  const { data: draftOrder } = useQuery({
    queryKey: ["/api/sleeper/draft", connection?.draft?.draft_id, "order"],
    queryFn: async () => {
      const response = await fetch(`/api/sleeper/draft/${connection?.draft?.draft_id}/order?userId=${connection?.user?.user_id}`);
      if (!response.ok) throw new Error('Failed to fetch draft order');
      return response.json();
    },
    enabled: !!connection?.draft?.draft_id,
    refetchInterval: 30000,
  });

  // Get draft recommendations
  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery({
    queryKey: ["/api/recommendations", Array.from(draftedPlayers)],
    enabled: !!connection && players.length > 0,
    refetchInterval: mockDraftMode ? 5000 : 30000,
  });

  const handleConnect = (connectionData: DraftConnection) => {
    connectMutation.mutate(connectionData);
  };

  const handlePlayerSelect = (player: PlayerWithKTC) => {
    setSelectedPlayer(player);
  };

  const handleDraftPlayer = (playerId: string) => {
    if (mockDraftMode) {
      setDraftedPlayers(prev => new Set([...prev, playerId]));
      toast({
        title: "Player drafted!",
        description: "Player added to mock draft",
      });
    }
  };

  const handleResetMockDraft = () => {
    setDraftedPlayers(new Set());
    setCurrentMockDraftId(null);
    toast({
      title: "Mock Draft Reset",
      description: "All drafted players have been cleared",
    });
  };

  const handleSaveMockDraft = async () => {
    if (!connection || draftedPlayers.size === 0) return;

    try {
      const mockDraftData = {
        id: currentMockDraftId || `mock_${Date.now()}`,
        user_id: connection.userId,
        name: `Mock Draft - ${new Date().toLocaleDateString()}`,
        league_settings: JSON.stringify({
          format: 'superflex',
          rounds: 15,
          teams: 12
        }),
        draft_order: JSON.stringify(Array.from({length: 12}, (_, i) => i + 1)),
        picks: JSON.stringify(Array.from(draftedPlayers)),
        current_pick: draftedPlayers.size + 1,
        is_completed: true,
        total_rounds: 15,
        total_teams: 12,
        notes: `Mock draft with ${draftedPlayers.size} picks`
      };

      const response = await apiRequest("POST", "/api/mock-drafts", mockDraftData);
      
      if (response.ok) {
        toast({
          title: "Mock Draft Saved",
          description: `Your mock draft session has been saved with ${draftedPlayers.size} picks`,
        });
        
        // Invalidate mock drafts cache to refresh history
        queryClient.invalidateQueries({ queryKey: ["/api/mock-drafts"] });
      }
    } catch (error) {
      console.error('Error saving mock draft:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save mock draft session",
        variant: "destructive"
      });
    }
  };

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const connectionStatus = connection ? "connected" : "disconnected";
  const isLoading = playersLoading || ktcLoading || connectMutation.isPending;

  return (
    <>
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Volleyball className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Dynasty Draft Analyzer</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' 
                  ? 'bg-secondary animate-pulse-slow' 
                  : 'bg-muted'
              }`} />
              <span>
                {connectionStatus === 'connected' ? 'Connected to League' : 'Not Connected'}
              </span>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Connection and Recommendations Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <ConnectionPanel 
              onConnect={handleConnect}
              isConnecting={connectMutation.isPending}
              connection={connection}
            />
          </div>
          
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Zap className="h-5 w-5 text-secondary mr-2" />
                    Draft Recommendations
                  </h3>
                  {mockDraftMode && (
                    <Badge variant="outline" className="text-accent border-accent">
                      <Activity className="h-3 w-3 mr-1" />
                      Mock Draft Mode
                    </Badge>
                  )}
                </div>
                
                {!connection ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Connect to your Sleeper league to get personalized recommendations</p>
                  </div>
                ) : recommendationsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => (
                      <div key={i} className="bg-muted rounded-lg p-4 animate-pulse">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-background rounded-lg" />
                          <div className="flex-1">
                            <div className="h-4 bg-background rounded mb-2" />
                            <div className="h-3 bg-background rounded w-2/3" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recommendations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendations.slice(0, 2).map((rec: any, index) => (
                      <div key={index} className="bg-muted rounded-lg p-4 border border-border hover:border-primary transition-colors">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="w-12 h-12 bg-background rounded-lg flex items-center justify-center">
                            <span className="text-lg font-bold text-primary">
                              {rec.player.position || '?'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              {rec.player.first_name} {rec.player.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {rec.player.position} - {rec.player.team}
                            </p>
                            <p className="text-sm text-secondary">
                              KTC: {rec.player.ktc_value?.toLocaleString() || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {index === 0 ? 'Top Value Pick' : 'Positional Need'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No recommendations available. Try refreshing KTC data.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Analytics Panel */}
        {connection && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <MockDraftHistory userId={connection.userId} />
            <DraftSlotTracker 
              totalRounds={15} 
              totalTeams={12} 
            />
          </div>
        )}

        {/* Draft Board */}
        {connection && (
          <DraftBoard 
            players={players}
            filters={filters}
            onFilterChange={handleFilterChange}
            onPlayerSelect={handlePlayerSelect}
            isLoading={isLoading}
            mockDraftMode={mockDraftMode}
            onToggleMockDraft={() => {
              if (mockDraftMode) {
                // When exiting mock draft mode, reset drafted players
                setDraftedPlayers(new Set());
                setCurrentMockDraftId(null);
                toast({
                  title: "Mock Draft Ended",
                  description: "All players are now available again",
                });
              }
              setMockDraftMode(!mockDraftMode);
            }}
            draftedPlayers={draftedPlayers}
            onDraftPlayer={handleDraftPlayer}
            onResetMockDraft={handleResetMockDraft}
            onSaveMockDraft={handleSaveMockDraft}
            draftOrder={draftOrder}
          />
        )}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <PlayerModal 
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onDraft={handleDraftPlayer}
          isDrafted={draftedPlayers.has(selectedPlayer.id)}
        />
      )}
    </>
  );
}
