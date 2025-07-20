import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Users, Trophy, Eye, Clock, FileText } from "lucide-react";
import { MockDraft, MockDraftPick } from "@shared/schema";
import { format } from "date-fns";

interface MockDraftHistoryProps {
  userId: string;
}

interface MockDraftWithPicks extends MockDraft {
  picks: MockDraftPick[];
}

export function MockDraftHistory({ userId }: MockDraftHistoryProps) {
  const [selectedDraft, setSelectedDraft] = useState<MockDraftWithPicks | null>(null);

  const { data: mockDrafts = [], isLoading } = useQuery({
    queryKey: ["/api/mock-drafts", userId],
    enabled: !!userId,
  });

  const { data: selectedDraftPicks = [] } = useQuery({
    queryKey: ["/api/mock-drafts", selectedDraft?.id, "picks"],
    enabled: !!selectedDraft,
  });

  const getCompletionStatus = (draft: MockDraft) => {
    if (draft.is_completed) return "Completed";
    const expectedPicks = (draft.total_rounds || 15) * (draft.total_teams || 12);
    const currentPick = draft.current_pick || 1;
    const progress = Math.round((currentPick / expectedPicks) * 100);
    return `${progress}% Complete`;
  };

  const getDraftSettings = (draft: MockDraft) => {
    try {
      const settings = JSON.parse(draft.league_settings);
      return {
        format: settings.format || 'superflex',
        rounds: draft.total_rounds || 15,
        teams: draft.total_teams || 12
      };
    } catch {
      return {
        format: 'superflex',
        rounds: draft.total_rounds || 15,
        teams: draft.total_teams || 12
      };
    }
  };

  const getPicksByRound = (picks: MockDraftPick[], round: number) => {
    return picks.filter(pick => pick.round === round).sort((a, b) => a.round_pick - b.round_pick);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            Mock Draft History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading mock draft history...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Trophy className="h-5 w-5 mr-2" />
          Mock Draft History
        </CardTitle>
        {mockDrafts.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {mockDrafts.length} mock draft{mockDrafts.length !== 1 ? 's' : ''} completed
          </p>
        )}
      </CardHeader>
      <CardContent>
        {mockDrafts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No mock drafts completed yet</p>
            <p className="text-sm">Start a mock draft to see your history here</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {mockDrafts.map((draft: MockDraft) => {
                const settings = getDraftSettings(draft);
                return (
                  <div key={draft.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{draft.name}</h4>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {format(new Date(draft.created_at), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {settings.teams} teams
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {settings.rounds} rounds
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={draft.is_completed ? "default" : "secondary"}>
                          {getCompletionStatus(draft)}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {settings.format}
                        </Badge>
                      </div>
                    </div>

                    {draft.notes && (
                      <div className="mb-3 p-2 bg-muted rounded text-sm">
                        <FileText className="h-4 w-4 inline mr-1" />
                        {draft.notes}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedDraft({ ...draft, picks: [] })}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>{draft.name} - Draft Details</DialogTitle>
                          </DialogHeader>
                          <MockDraftDetails 
                            draft={draft} 
                            picks={selectedDraftPicks}
                            settings={settings}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

interface MockDraftDetailsProps {
  draft: MockDraft;
  picks: MockDraftPick[];
  settings: {
    format: string;
    rounds: number;
    teams: number;
  };
}

function MockDraftDetails({ draft, picks, settings }: MockDraftDetailsProps) {
  const [selectedRound, setSelectedRound] = useState(1);

  const rounds = Array.from({ length: settings.rounds }, (_, i) => i + 1);
  const roundPicks = getPicksByRound(picks, selectedRound);

  return (
    <div className="space-y-6">
      {/* Draft Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-muted rounded">
          <div className="text-2xl font-bold">{settings.teams}</div>
          <div className="text-sm text-muted-foreground">Teams</div>
        </div>
        <div className="text-center p-3 bg-muted rounded">
          <div className="text-2xl font-bold">{settings.rounds}</div>
          <div className="text-sm text-muted-foreground">Rounds</div>
        </div>
        <div className="text-center p-3 bg-muted rounded">
          <div className="text-2xl font-bold">{picks.length}</div>
          <div className="text-sm text-muted-foreground">Picks Made</div>
        </div>
        <div className="text-center p-3 bg-muted rounded">
          <div className="text-2xl font-bold capitalize">{settings.format}</div>
          <div className="text-sm text-muted-foreground">Format</div>
        </div>
      </div>

      <Separator />

      {/* Round Navigation */}
      <div>
        <h4 className="font-semibold mb-3">Draft Rounds</h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {rounds.map(round => (
            <Button
              key={round}
              variant={selectedRound === round ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRound(round)}
            >
              Round {round}
            </Button>
          ))}
        </div>

        {/* Round Picks */}
        <div className="border rounded-lg">
          <div className="p-3 bg-muted font-medium">
            Round {selectedRound} Picks
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-3">
              {roundPicks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No picks made in this round
                </div>
              ) : (
                <div className="space-y-2">
                  {roundPicks.map(pick => (
                    <div 
                      key={pick.id} 
                      className={`flex items-center justify-between p-3 rounded border ${
                        pick.is_user_pick ? 'bg-primary/10 border-primary/20' : 'bg-background'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="font-mono text-sm font-medium w-12">
                          {pick.pick}
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
                        <div className="text-sm font-medium">
                          Team {pick.team_id}
                        </div>
                        {pick.is_user_pick && (
                          <Badge variant="default" size="sm">Your Pick</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function getPicksByRound(picks: MockDraftPick[], round: number): MockDraftPick[] {
  return picks.filter(pick => pick.round === round).sort((a, b) => a.round_pick - b.round_pick);
}