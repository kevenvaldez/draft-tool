import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, TrendingUp, User } from "lucide-react";
import { MockDraftPick } from "@shared/schema";

interface DraftSlotTrackerProps {
  totalRounds: number;
  totalTeams: number;
}

interface SlotData {
  round: number;
  pick: number;
  picks: MockDraftPick[];
  averageValue?: number;
  topPositions: string[];
}

export function DraftSlotTracker({ totalRounds = 15, totalTeams = 12 }: DraftSlotTrackerProps) {
  const [selectedRound, setSelectedRound] = useState(1);
  const [selectedPick, setSelectedPick] = useState(1);

  // Query for historical picks at the selected slot
  const { data: slotPicks = [], isLoading } = useQuery({
    queryKey: ["/api/mock-drafts/picks/slot", selectedRound, selectedPick],
    enabled: selectedRound > 0 && selectedPick > 0,
  });

  // Generate rounds and picks for selection
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
  const picks = Array.from({ length: totalTeams }, (_, i) => i + 1);

  // Calculate overall pick number
  const overallPick = (selectedRound - 1) * totalTeams + selectedPick;

  // Analyze position trends at this slot
  const positionCounts = slotPicks.reduce((acc: Record<string, number>, pick) => {
    const position = pick.player_position || 'Unknown';
    acc[position] = (acc[position] || 0) + 1;
    return acc;
  }, {});

  const sortedPositions = Object.entries(positionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  const getPositionPercentage = (count: number) => {
    return slotPicks.length > 0 ? Math.round((count / slotPicks.length) * 100) : 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Draft Slot Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          See what players have been taken at each draft position historically
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Slot Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Round</label>
            <Select
              value={selectedRound.toString()}
              onValueChange={(value) => setSelectedRound(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rounds.map(round => (
                  <SelectItem key={round} value={round.toString()}>
                    Round {round}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Pick</label>
            <Select
              value={selectedPick.toString()}
              onValueChange={(value) => setSelectedPick(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {picks.map(pick => (
                  <SelectItem key={pick} value={pick.toString()}>
                    Pick {pick}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Slot Summary */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold">
              Pick #{overallPick}
            </div>
            <div className="text-sm text-muted-foreground">
              Round {selectedRound}, Pick {selectedPick}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {slotPicks.length} historical selection{slotPicks.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Position Trends */}
        {slotPicks.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Position Trends at This Slot
            </h4>
            <div className="space-y-2">
              {sortedPositions.map(([position, count]) => (
                <div key={position} className="flex items-center justify-between p-3 bg-muted rounded">
                  <span className="font-medium">{position}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {count} pick{count !== 1 ? 's' : ''}
                    </span>
                    <Badge variant="secondary">
                      {getPositionPercentage(count)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historical Picks */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center">
            <User className="h-4 w-4 mr-2" />
            Recent Picks at This Slot
          </h4>
          
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading historical picks...
            </div>
          ) : slotPicks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No historical data for this slot</p>
              <p className="text-sm">Complete more mock drafts to see trends</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {slotPicks.slice(0, 10).map((pick, index) => (
                  <div 
                    key={pick.id} 
                    className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-sm text-muted-foreground">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-medium">
                          {pick.player_name || 'Unknown Player'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {pick.player_position} • {pick.player_team}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {pick.picked_at ? new Date(pick.picked_at).toLocaleDateString() : 'Unknown date'}
                      </div>
                      {pick.is_user_pick && (
                        <Badge variant="outline" size="sm">Your Pick</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Quick Navigation */}
        <div className="border-t pt-4">
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (overallPick > 1) {
                  const newOverall = overallPick - 1;
                  const newRound = Math.ceil(newOverall / totalTeams);
                  const newPick = newOverall - (newRound - 1) * totalTeams;
                  setSelectedRound(newRound);
                  setSelectedPick(newPick);
                }
              }}
              disabled={overallPick <= 1}
            >
              ← Previous Pick
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const maxPick = totalRounds * totalTeams;
                if (overallPick < maxPick) {
                  const newOverall = overallPick + 1;
                  const newRound = Math.ceil(newOverall / totalTeams);
                  const newPick = newOverall - (newRound - 1) * totalTeams;
                  setSelectedRound(newRound);
                  setSelectedPick(newPick);
                }
              }}
              disabled={overallPick >= totalRounds * totalTeams}
            >
              Next Pick →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}