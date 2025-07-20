import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { DraftConnection } from "@/lib/types";

interface ConnectionPanelProps {
  onConnect: (connection: DraftConnection) => void;
  isConnecting: boolean;
  connection: any | null;
}

export function ConnectionPanel({ onConnect, isConnecting, connection }: ConnectionPanelProps) {
  const [leagueId, setLeagueId] = useState("");
  const [draftId, setDraftId] = useState("");
  const [userId, setUserId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueId.trim() || !draftId.trim() || !userId.trim()) {
      return;
    }
    
    onConnect({
      leagueId: leagueId.trim(),
      draftId: draftId.trim(),
      userId: userId.trim(),
    });
  };

  const isConnected = !!connection;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Link className="h-5 w-5 text-primary mr-2" />
            Sleeper Connection
          </h3>
          {isConnected && (
            <Badge variant="default" className="bg-secondary text-secondary-foreground">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>

        {isConnected && connection ? (
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3">
              <div className="text-sm font-medium text-foreground">
                {connection.league?.name || 'League Name'}
              </div>
              <div className="text-xs text-muted-foreground">
                {connection.league?.season} • {connection.league?.total_rosters} teams
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-sm font-medium text-foreground">
                {connection.draft?.type?.replace('_', ' ').toUpperCase() || 'Draft'} Draft
              </div>
              <div className="text-xs text-muted-foreground">
                Status: {connection.draft?.status || 'Unknown'}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-sm font-medium text-foreground">
                {connection.user?.display_name || connection.user?.username || 'User'}
              </div>
              <div className="text-xs text-muted-foreground">
                Connected as manager
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Disconnect & Reconnect
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leagueId" className="text-sm font-medium text-muted-foreground">
                League ID
              </Label>
              <Input
                id="leagueId"
                type="text"
                placeholder="Enter your league ID"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                disabled={isConnecting}
                className="bg-background border-border focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                Find this in your Sleeper league URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="draftId" className="text-sm font-medium text-muted-foreground">
                Draft ID
              </Label>
              <Input
                id="draftId"
                type="text"
                placeholder="Enter draft ID"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                disabled={isConnecting}
                className="bg-background border-border focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                Available in draft settings or URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userId" className="text-sm font-medium text-muted-foreground">
                User ID
              </Label>
              <Input
                id="userId"
                type="text"
                placeholder="Enter your user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={isConnecting}
                className="bg-background border-border focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                Found in your Sleeper profile URL
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isConnecting || !leagueId.trim() || !draftId.trim() || !userId.trim()}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Connect & Sync
                </>
              )}
            </Button>

            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">How to find your IDs:</p>
                  <ul className="space-y-1">
                    <li>• League ID: In your league URL after "league/"</li>
                    <li>• Draft ID: In draft page URL or league settings</li>
                    <li>• User ID: In your profile URL after "user/"</li>
                  </ul>
                </div>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
