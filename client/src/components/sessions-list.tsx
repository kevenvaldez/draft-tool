import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trash2, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface Session {
  id: number;
  league_id: string;
  draft_id: string;
  user_id: string;
  league_name: string;
  last_used: string;
  created_at: string;
}

interface SessionsListProps {
  onSessionSelect: (session: Session) => void;
}

export function SessionsList({ onSessionSelect }: SessionsListProps) {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["/api/sessions"],
    refetchInterval: false,
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: number) => 
      apiRequest(`/api/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const handleDelete = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this session?")) {
      await deleteSessionMutation.mutateAsync(sessionId);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400">Loading sessions...</div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400">No previous sessions found. Connect to a league to start.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Sessions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.map((session: Session) => (
          <div
            key={session.id}
            className="bg-slate-700 p-3 rounded-lg border border-slate-600 hover:bg-slate-600 cursor-pointer transition-colors group"
            onClick={() => onSessionSelect(session)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-white font-medium truncate">
                  {session.league_name}
                </div>
                <div className="text-slate-400 text-sm flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(session.last_used), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleDelete(session.id, e)}
                disabled={deleteSessionMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}