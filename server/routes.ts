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

      // Store league and draft data
      if (validation.league) {
        await storage.createLeague({
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
        await storage.createDraft({
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

      // Clear existing players and reload with active NFL players only
      await storage.clearAllPlayers();
      
      // Auto-fetch and store Sleeper player data
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
      
      // Calculate user's upcoming picks
      const userPicks = [];
      if (draft.draft_order && userRosterId) {
        const userDraftPosition = draft.draft_order[userRosterId];
        
        for (let round = currentRound; round <= totalRounds; round++) {
          let pickInCurrentRound;
          
          // Handle snake draft format
          if (round % 2 === 1) {
            // Odd rounds: normal order
            pickInCurrentRound = userDraftPosition;
          } else {
            // Even rounds: reverse order (snake)
            pickInCurrentRound = totalTeams - userDraftPosition + 1;
          }
          
          const absolutePick = (round - 1) * totalTeams + pickInCurrentRound;
          
          // Only include future picks
          if (absolutePick >= currentPickNumber) {
            userPicks.push({
              round,
              pickInRound: pickInCurrentRound,
              absolutePick,
              isNext: absolutePick === currentPickNumber && userRosterId,
              picksAway: absolutePick - currentPickNumber
            });
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

  const httpServer = createServer(app);
  return httpServer;
}
