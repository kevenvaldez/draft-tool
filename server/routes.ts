import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sleeperService } from "./services/sleeper";
import { ktcService } from "./services/ktc";
import { insertLeagueSchema, insertDraftSchema, insertPlayerSchema, insertMockDraftSchema, insertWatchlistSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Sleeper API Integration Routes
  app.post("/api/sleeper/connect", async (req, res) => {
    try {
      const { leagueId, draftId, userId } = req.body;
      
      if (!leagueId || !draftId || !userId) {
        return res.status(400).json({ 
          message: "Missing required fields: leagueId, draftId, userId" 
        });
      }

      const validation = await sleeperService.validateConnection(leagueId, draftId, userId);
      
      if (!validation.valid) {
        return res.status(400).json({ 
          message: validation.error || "Invalid connection parameters" 
        });
      }

      // Store league and draft data (upsert to handle existing records)
      if (validation.league) {
        await storage.upsertLeague({
          id: validation.league.league_id,
          name: validation.league.name,
          sport: validation.league.sport,
          season: validation.league.season,
          status: validation.league.status,
          total_rosters: validation.league.total_rosters,
          settings: JSON.stringify(validation.league.settings)
        });
      }

      if (validation.draft) {
        await storage.upsertDraft({
          id: validation.draft.draft_id,
          league_id: validation.draft.league_id,
          type: validation.draft.type,
          status: validation.draft.status,
          sport: validation.draft.sport,
          season: validation.draft.season,
          settings: JSON.stringify(validation.draft.settings),
          start_time: validation.draft.start_time ? new Date(validation.draft.start_time) : null
        });
      }

      // Check if we already have player data to avoid expensive reload on every connection
      const existingPlayers = await storage.getAllPlayers();
      
      if (existingPlayers.length === 0) {
        console.log("No player data found, loading from Sleeper API...");
        
        // Auto-fetch and store Sleeper player data (only if database is empty)
        try {
          const players = await sleeperService.getAllPlayers();
          const playerArray = Object.values(players);
          
          // Store only active NFL players on rosters
          const activeNFLPlayers = playerArray
            .filter(p => 
              p.player_id && 
              p.position && 
              ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
              p.team && // Must have a team
              p.team !== 'FA' && // Not free agent
              p.status === 'Active' // Active status
            )
            .slice(0, 800); // Increased limit for active players
          
          for (const player of activeNFLPlayers) {
            try {
              await storage.upsertPlayer({
                id: player.player_id,
                first_name: player.first_name,
                last_name: player.last_name,
                position: player.position,
                team: player.team,
                age: player.age,
                years_exp: player.years_exp,
                height: player.height,
                weight: player.weight,
                status: player.status,
                injury_status: player.injury_status
              });
            } catch (error) {
              console.warn(`Failed to store player ${player.player_id}:`, error instanceof Error ? error.message : error);
            }
          }
          
          console.log(`Stored ${activeNFLPlayers.length} active NFL players from Sleeper API`);
        } catch (error) {
          console.warn("Failed to auto-load Sleeper players:", error);
          // Don't fail the connection if player loading fails
        }
      } else {
        console.log(`Using existing player data (${existingPlayers.length} players)`);
      }

      // Save session for easy reconnection
      if (validation.league && validation.draft) {
        await storage.createSession({
          league_id: validation.league.league_id,
          draft_id: validation.draft.draft_id,
          user_id: userId,
          league_name: validation.league.name
        });
      }

      res.json({
        success: true,
        league: validation.league,
        draft: validation.draft,
        user: validation.user
      });
    } catch (error) {
      console.error("Sleeper connection error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to connect to Sleeper" 
      });
    }
  });

  app.get("/api/sleeper/draft/:draftId/picks", async (req, res) => {
    try {
      const { draftId } = req.params;
      const picks = await sleeperService.getDraftPicks(draftId);
      
      // Store picks in local storage
      for (const pick of picks) {
        await storage.createDraftPick({
          draft_id: pick.draft_id,
          player_id: pick.player_id,
          picked_by: pick.picked_by,
          roster_id: pick.roster_id,
          round: pick.round,
          pick_no: pick.pick_no,
          is_keeper: pick.is_keeper,
          metadata: JSON.stringify(pick.metadata)
        });
      }

      res.json(picks);
    } catch (error) {
      console.error("Error fetching draft picks:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch draft picks" 
      });
    }
  });

  // Get draft order and current pick information
  app.get("/api/sleeper/draft/:draftId/order", async (req, res) => {
    try {
      const { draftId } = req.params;
      const { userId } = req.query;
      
      const [draft, picks] = await Promise.all([
        sleeperService.getDraft(draftId),
        sleeperService.getDraftPicks(draftId)
      ]);

      // Calculate draft order and current pick
      const totalRounds = draft.settings?.rounds || 15;
      const totalTeams = Object.keys(draft.draft_order || {}).length || 12;
      const totalPicks = totalRounds * totalTeams;
      
      // Find current pick number
      const completedPicks = picks.filter(p => p.player_id).length;
      const currentPickNumber = completedPicks + 1;
      
      // Calculate round and pick in round
      const currentRound = Math.ceil(currentPickNumber / totalTeams);
      const pickInRound = ((currentPickNumber - 1) % totalTeams) + 1;
      
      // Get user's roster ID
      const userRosterId = userId ? Object.entries(draft.draft_order || {})
        .find(([rosterId, position]) => rosterId === userId)?.[0] : null;
      
      // Get traded picks data to determine actual pick ownership
      let tradedPicks: any[] = [];
      try {
        tradedPicks = await sleeperService.getTradedPicks(draft.league_id);
      } catch (error) {
        console.warn("Could not fetch traded picks, using original draft order");
      }

      // Calculate user's actual upcoming picks (including traded picks)
      const userPicks = [];
      if (draft.draft_order && userRosterId) {
        const userRosterNumber = parseInt(userRosterId);
        
        // Generate all remaining picks and check ownership
        for (let round = currentRound; round <= totalRounds; round++) {
          for (let pick = 1; pick <= totalTeams; pick++) {
            const absolutePick = (round - 1) * totalTeams + pick;
            
            // Skip already completed picks
            if (absolutePick < currentPickNumber) continue;
            
            // Determine original owner for this pick position in snake format
            let originalPosition;
            if (round % 2 === 1) {
              // Odd rounds: normal order (1, 2, 3...)
              originalPosition = pick;
            } else {
              // Even rounds: reverse order (...3, 2, 1)
              originalPosition = totalTeams - pick + 1;
            }
            
            // Find original owner roster ID
            const originalOwnerEntry = Object.entries(draft.draft_order).find(
              ([rosterId, position]) => position === originalPosition
            );
            const originalOwnerRosterId = originalOwnerEntry ? parseInt(originalOwnerEntry[0]) : null;
            
            // Check if this pick was traded to the user
            let currentOwner = originalOwnerRosterId;
            const tradedPick = tradedPicks.find(tp => 
              tp.season === draft.season && 
              tp.round === round && 
              tp.previous_owner_id === originalOwnerRosterId
            );
            
            if (tradedPick) {
              currentOwner = tradedPick.owner_id;
            }
            
            // If user owns this pick, add it to their list
            if (currentOwner === userRosterNumber) {
              userPicks.push({
                round,
                pickInRound: pick,
                absolutePick,
                isNext: absolutePick === currentPickNumber,
                picksAway: absolutePick - currentPickNumber,
                isTraded: !!tradedPick
              });
            }
          }
        }
      }

      res.json({
        currentPick: {
          round: currentRound,
          pickInRound: pickInRound,
          absolutePick: currentPickNumber,
          totalPicks
        },
        userPicks: userPicks.slice(0, 5), // Next 5 user picks
        draftOrder: draft.draft_order,
        tradedPicksCount: tradedPicks.length,
        settings: {
          rounds: totalRounds,
          teams: totalTeams,
          type: draft.type
        }
      });
    } catch (error) {
      console.error("Error fetching draft order:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch draft order" 
      });
    }
  });

  app.get("/api/sleeper/players", async (req, res) => {
    try {
      const players = await sleeperService.getAllPlayers();
      const playerArray = Object.values(players);

      // Store players in local storage
      for (const player of playerArray) {
        if (player.player_id && player.position) {
          await storage.createPlayer({
            id: player.player_id,
            first_name: player.first_name,
            last_name: player.last_name,
            position: player.position,
            team: player.team,
            age: player.age,
            years_exp: player.years_exp,
            height: player.height,
            weight: player.weight,
            status: player.status,
            injury_status: player.injury_status
          });
        }
      }

      res.json(playerArray);
    } catch (error) {
      console.error("Error fetching Sleeper players:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch Sleeper players" 
      });
    }
  });

  // KeepTradeCut Integration Routes
  app.get("/api/ktc/rankings", async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const rankings = await ktcService.getRankings(forceRefresh);
      res.json(rankings);
    } catch (error) {
      console.error("Error fetching KTC rankings:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch KeepTradeCut rankings" 
      });
    }
  });

  app.get("/api/ktc/player/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const { position } = req.query;
      const value = await ktcService.getPlayerValue(name, position as string);
      res.json({ name, value });
    } catch (error) {
      console.error("Error fetching KTC player value:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch player value" 
      });
    }
  });

  app.get("/api/ktc/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }

      const players = await ktcService.searchPlayers(q);
      res.json(players);
    } catch (error) {
      console.error("Error searching KTC players:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to search players" 
      });
    }
  });

  app.post("/api/ktc/refresh", async (req, res) => {
    try {
      const rankings = await ktcService.getRankings(true); // Force refresh
      res.json({ 
        message: "KTC rankings refreshed", 
        playerCount: rankings.players.length,
        lastUpdated: rankings.lastUpdated 
      });
    } catch (error) {
      console.error("Error refreshing KTC rankings:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to refresh KTC rankings" 
      });
    }
  });

  // Player Management Routes
  app.get("/api/players", async (req, res) => {
    try {
      const { position, team, search, available } = req.query;
      let players = await storage.getAllPlayers();

      // Filter out non-rostered players by default
      players = players.filter(p => 
        p.team && 
        p.team !== 'FA' && 
        p.team !== null && 
        p.status === 'Active' &&
        p.position &&
        ['QB', 'RB', 'WR', 'TE'].includes(p.position)
      );

      // Apply additional filters
      if (position && typeof position === 'string') {
        players = players.filter(p => p.position === position);
      }
      if (team && typeof team === 'string') {
        players = players.filter(p => p.team === team);
      }
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        players = players.filter(p => 
          p.first_name?.toLowerCase().includes(searchLower) ||
          p.last_name?.toLowerCase().includes(searchLower) ||
          p.team?.toLowerCase().includes(searchLower) ||
          p.position?.toLowerCase().includes(searchLower)
        );
      }

      // Enrich with KTC values if not present
      for (const player of players) {
        if (!player.ktc_value && player.first_name && player.last_name) {
          const fullName = `${player.first_name} ${player.last_name}`;
          const value = await ktcService.getPlayerValue(fullName, player.position || undefined);
          if (value) {
            await storage.updatePlayer(player.id, { ktc_value: value });
            player.ktc_value = value;
          }
        }
      }

      res.json(players);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch players" 
      });
    }
  });

  app.get("/api/players/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const player = await storage.getPlayer(id);
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      res.json(player);
    } catch (error) {
      console.error("Error fetching player:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch player" 
      });
    }
  });

  // Mock Draft Routes
  app.post("/api/mock-drafts", async (req, res) => {
    try {
      const validated = insertMockDraftSchema.parse(req.body);
      const mockDraft = await storage.createMockDraft(validated);
      res.json(mockDraft);
    } catch (error) {
      console.error("Error creating mock draft:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid mock draft data", errors: error.errors });
      }
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create mock draft" 
      });
    }
  });

  app.get("/api/mock-drafts/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const mockDrafts = await storage.getMockDraftsByUser(userId);
      res.json(mockDrafts);
    } catch (error) {
      console.error("Error fetching user mock drafts:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch mock drafts" 
      });
    }
  });

  app.get("/api/mock-drafts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const mockDraft = await storage.getMockDraft(id);
      
      if (!mockDraft) {
        return res.status(404).json({ message: "Mock draft not found" });
      }

      res.json(mockDraft);
    } catch (error) {
      console.error("Error fetching mock draft:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch mock draft" 
      });
    }
  });

  app.put("/api/mock-drafts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const mockDraft = await storage.updateMockDraft(id, updates);
      
      if (!mockDraft) {
        return res.status(404).json({ message: "Mock draft not found" });
      }

      res.json(mockDraft);
    } catch (error) {
      console.error("Error updating mock draft:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to update mock draft" 
      });
    }
  });

  app.delete("/api/mock-drafts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteMockDraft(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Mock draft not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting mock draft:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete mock draft" 
      });
    }
  });

  // Watchlist Routes
  app.get("/api/watchlist/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const watchlist = await storage.getWatchlist(userId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch watchlist" 
      });
    }
  });

  app.post("/api/watchlist", async (req, res) => {
    try {
      const validated = insertWatchlistSchema.parse(req.body);
      const item = await storage.addToWatchlist(validated);
      res.json(item);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid watchlist data", errors: error.errors });
      }
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to add to watchlist" 
      });
    }
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.removeFromWatchlist(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Watchlist item not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to remove from watchlist" 
      });
    }
  });

  // Draft recommendations endpoint
  app.post("/api/recommendations", async (req, res) => {
    try {
      const { leagueSettings, draftedPlayers, currentPick, userNeeds } = req.body;
      
      // Get all available players
      const allPlayers = await storage.getAllPlayers();
      const draftedPlayerIds = new Set(draftedPlayers || []);
      const availablePlayers = allPlayers.filter(p => !draftedPlayerIds.has(p.id));

      // Sort by KTC value and positional need
      const recommendations = availablePlayers
        .filter(p => p.ktc_value && p.ktc_value > 0)
        .sort((a, b) => (b.ktc_value || 0) - (a.ktc_value || 0))
        .slice(0, 10);

      res.json({ recommendations });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate recommendations" 
      });
    }
  });

  // Session Management Routes
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch sessions" 
      });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSession(id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Session not found" });
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete session" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
