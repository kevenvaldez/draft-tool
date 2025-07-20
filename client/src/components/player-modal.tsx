import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Star, 
  Plus, 
  TrendingUp, 
  Activity, 
  Award,
  Calendar,
  Users,
  Target
} from "lucide-react";
import type { PlayerWithKTC } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PlayerModalProps {
  player: PlayerWithKTC;
  onClose: () => void;
  onDraft: (playerId: string) => void;
  isDrafted: boolean;
}

export function PlayerModal({ player, onClose, onDraft, isDrafted }: PlayerModalProps) {
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
  const displayName = fullName || 'Unknown Player';
  const ktcValue = player.ktc_value || 0;
  const valuePercentage = Math.min((ktcValue / 10000) * 100, 100);

  const addToWatchlistMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/watchlist", {
        user_id: "temp_user", // In real app, get from auth
        player_id: player.id,
        notes: notes.trim() || undefined
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to watchlist",
        description: `${displayName} has been added to your watchlist`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to add to watchlist",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const getPositionColor = (position?: string) => {
    switch (position) {
      case 'QB': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'RB': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'WR': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'TE': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getExperienceText = (years?: number) => {
    if (years === undefined || years === null) return 'Unknown';
    if (years === 0) return 'Rookie';
    return `${years} year${years > 1 ? 's' : ''}`;
  };

  const getRecommendationText = (value: number): { text: string; color: string } => {
    if (value > 8000) return { 
      text: "Elite dynasty asset. Strong recommendation to draft if available.", 
      color: "text-green-400" 
    };
    if (value > 6000) return { 
      text: "High-value player with excellent upside. Consider drafting.", 
      color: "text-secondary" 
    };
    if (value > 4000) return { 
      text: "Solid dynasty option. Good value at current ADP.", 
      color: "text-primary" 
    };
    if (value > 2000) return { 
      text: "Depth piece with some upside. Late round target.", 
      color: "text-accent" 
    };
    return { 
      text: "Limited dynasty value. Consider other options.", 
      color: "text-muted-foreground" 
    };
  };

  const recommendation = getRecommendationText(ktcValue);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Player Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Player Header */}
          <div className="flex items-center space-x-4">
            <div className={`w-20 h-20 rounded-xl flex items-center justify-center text-lg font-bold border-2 ${
              getPositionColor(player.position)
            }`}>
              {player.position || '?'}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground">
                {displayName}
              </h2>
              <p className="text-lg text-muted-foreground">
                {player.position} - {player.team || 'Free Agent'}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                {player.age && (
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    <Calendar className="h-3 w-3 mr-1" />
                    Age {player.age}
                  </Badge>
                )}
                <Badge variant="outline" className="border-secondary/30 text-secondary">
                  <Users className="h-3 w-3 mr-1" />
                  {getExperienceText(player.years_exp)}
                </Badge>
                {player.status && (
                  <Badge 
                    variant={player.status === 'Active' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {player.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dynasty Value */}
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <h5 className="font-semibold text-secondary mb-3 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Dynasty Value
                </h5>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">KTC Value:</span>
                    <span className="font-semibold text-lg">
                      {ktcValue > 0 ? ktcValue.toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  {player.ktc_rank && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Position Rank:</span>
                      <span className="font-semibold">#{player.ktc_rank} {player.position}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overall Rank:</span>
                    <span className="font-semibold">
                      #{player.ktc_rank || 'N/A'}
                    </span>
                  </div>
                  {ktcValue > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Value Score</span>
                        <span className="font-medium">{Math.round(valuePercentage)}%</span>
                      </div>
                      <Progress 
                        value={valuePercentage} 
                        className="h-2"
                        style={{
                          '--progress-background': 'hsl(var(--secondary))',
                        } as React.CSSProperties}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Physical Info */}
              {(player.height || player.weight) && (
                <div className="bg-muted rounded-lg p-4">
                  <h5 className="font-semibold text-accent mb-3 flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Physical
                  </h5>
                  <div className="space-y-2">
                    {player.height && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Height:</span>
                        <span className="font-semibold">{player.height}</span>
                      </div>
                    )}
                    {player.weight && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weight:</span>
                        <span className="font-semibold">{player.weight} lbs</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Draft Analysis */}
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <h5 className="font-semibold text-primary mb-3 flex items-center">
                  <Target className="h-4 w-4 mr-2" />
                  Draft Analysis
                </h5>
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground text-sm block mb-1">
                      Recommendation
                    </span>
                    <p className={`text-sm leading-relaxed ${recommendation.color}`}>
                      {recommendation.text}
                    </p>
                  </div>
                  {ktcValue > 0 && (
                    <div className="p-3 bg-background rounded border border-border">
                      <div className="text-xs text-muted-foreground mb-1">
                        Dynasty Tier
                      </div>
                      <div className="text-sm font-medium">
                        {ktcValue > 8000 && "Elite (Tier 1)"}
                        {ktcValue <= 8000 && ktcValue > 6000 && "High Value (Tier 2)"}
                        {ktcValue <= 6000 && ktcValue > 4000 && "Solid (Tier 3)"}
                        {ktcValue <= 4000 && ktcValue > 2000 && "Depth (Tier 4)"}
                        {ktcValue <= 2000 && "Speculative (Tier 5)"}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Watchlist Notes */}
              <div className="bg-muted rounded-lg p-4">
                <h5 className="font-semibold mb-3 flex items-center">
                  <Star className="h-4 w-4 mr-2" />
                  Notes
                </h5>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="notes" className="text-sm text-muted-foreground">
                      Add to watchlist with notes
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Add personal notes about this player..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 bg-background border-border resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-border">
            {!isDrafted && (
              <Button 
                onClick={() => onDraft(player.id)}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Draft Player
              </Button>
            )}
            <Button 
              onClick={() => addToWatchlistMutation.mutate()}
              variant="outline"
              className="flex-1"
              disabled={addToWatchlistMutation.isPending}
            >
              <Star className="h-4 w-4 mr-2" />
              {addToWatchlistMutation.isPending ? "Adding..." : "Add to Watchlist"}
            </Button>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>

          {isDrafted && (
            <div className="text-center py-4">
              <Badge variant="secondary" className="text-sm px-4 py-2">
                <Award className="h-4 w-4 mr-2" />
                Player has been drafted
              </Badge>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
