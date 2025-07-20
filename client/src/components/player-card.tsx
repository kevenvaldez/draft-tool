import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, Eye } from "lucide-react";
import type { PlayerWithKTC } from "@/lib/types";

interface PlayerCardProps {
  player: PlayerWithKTC;
  onClick: () => void;
  onDraft?: () => void;
  isDrafted?: boolean;
  mockDraftMode?: boolean;
}

export function PlayerCard({ 
  player, 
  onClick, 
  onDraft, 
  isDrafted = false, 
  mockDraftMode = false 
}: PlayerCardProps) {
  const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
  const displayName = fullName || 'Unknown Player';
  const ktcValue = player.ktc_value || 0;
  const valuePercentage = Math.min((ktcValue / 10000) * 100, 100);

  const getPositionColor = (position?: string) => {
    switch (position) {
      case 'QB': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'RB': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'WR': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'TE': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusColor = () => {
    if (isDrafted) return 'bg-muted/50 text-muted-foreground';
    return 'hover:border-primary';
  };

  return (
    <Card 
      className={`transition-all duration-200 cursor-pointer group ${getStatusColor()} ${
        isDrafted ? 'opacity-60' : ''
      }`}
      onClick={!isDrafted ? onClick : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold border ${
            getPositionColor(player.position)
          }`}>
            {player.position || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate">
              {displayName}
            </h4>
            <p className="text-sm text-muted-foreground">
              {player.position} - {player.team || 'FA'}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              {player.age && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 border-primary/30 text-primary">
                  Age {player.age}
                </Badge>
              )}
              {player.years_exp !== undefined && player.years_exp !== null && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 border-secondary/30 text-secondary">
                  {player.years_exp === 0 ? 'Rookie' : `${player.years_exp}Y`}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">KTC Value:</span>
            <span className="text-sm font-semibold text-secondary">
              {ktcValue > 0 ? ktcValue.toLocaleString() : 'N/A'}
            </span>
          </div>
          
          {player.ktc_rank && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rank:</span>
              <span className="text-sm font-semibold">
                #{player.ktc_rank} {player.position}
              </span>
            </div>
          )}

          {ktcValue > 0 && (
            <div className="space-y-1">
              <Progress 
                value={valuePercentage} 
                className="h-2 bg-muted"
                style={{
                  '--progress-background': 'hsl(var(--secondary))',
                } as React.CSSProperties}
              />
              <div className="text-xs text-muted-foreground text-center">
                Value Score: {Math.round(valuePercentage)}%
              </div>
            </div>
          )}

          {mockDraftMode && !isDrafted && onDraft && (
            <div className="flex space-x-2 mt-3">
              <Button
                size="sm"
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={(e) => {
                  e.stopPropagation();
                  onDraft();
                }}
              >
                Draft
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          )}

          {isDrafted && (
            <div className="mt-3">
              <Badge variant="secondary" className="w-full justify-center">
                Drafted
              </Badge>
            </div>
          )}

          {player.injury_status && (
            <div className="mt-2">
              <Badge variant="destructive" className="text-xs">
                {player.injury_status}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
