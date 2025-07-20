import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sleeperService } from "./services/sleeper";
import { ktcService } from "./services/ktc";
import { insertLeagueSchema, insertDraftSchema, insertPlayerSchema, insertMockDraftSchema, insertMockDraftPickSchema, insertWatchlistSchema } from "@shared/schema";
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

      // Use the new data caching system for efficient player data management
      const { dataCacheService } = await import('./services/data-cache');
      
      // Ensure player data is current (will refresh if stale)
      const wasDataCurrent = await dataCacheService.ensureDataIsCurrent();
      
      if (!wasDataCurrent) {
        console.log("Data refreshed automatically due to staleness");
      } else {
        const existingPlayers = await storage.getAllPlayers();
        console.log(`Using cached player data (${existingPlayers.length} players)`);
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
      
      // If not forcing refresh, use cached database data for speed
      if (!forceRefresh) {
        const players = await storage.getAllPlayers();
        const ktcPlayers = players
          .filter(p => p.ktc_value && p.ktc_value > 0)
          .sort((a, b) => (b.ktc_value || 0) - (a.ktc_value || 0))
          .map(p => ({
            name: `${p.first_name} ${p.last_name}`,
            team: p.team,
            position: p.position,
            value: p.ktc_value
          }));
        
        return res.json({
          players: ktcPlayers,
          lastUpdated: new Date().toISOString(),
          source: 'cached'
        });
      }
      
      // Only scrape if explicitly requested
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

  // Update all KTC values with curated data
  app.post("/api/ktc/update-values", async (req, res) => {
    try {
      const { updateAllKTCValues } = await import('./scripts/update-ktc-values');
      const updatedCount = await updateAllKTCValues();
      res.json({
        message: "KTC values updated successfully",
        updatedCount
      });
    } catch (error) {
      console.error("Error updating KTC values:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to update KTC values" 
      });
    }
  });

  // Clear and rescrape all player data from KTC
  app.post("/api/ktc/fresh-scrape", async (req, res) => {
    try {
      console.log("Starting fresh KTC scrape...");
      const { clearAndRescrapeKTC } = await import('./scripts/fresh-ktc-scrape');
      const result = await clearAndRescrapeKTC();
      res.json({
        message: "Fresh KTC scrape completed successfully",
        ...result
      });
    } catch (error) {
      console.error("Error during fresh KTC scrape:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to complete fresh KTC scrape" 
      });
    }
  });

  // Accurate KTC scraper with proper URL format
  app.post("/api/ktc/accurate-scrape", async (req, res) => {
    try {
      console.log("Starting accurate KTC scrape with correct URL...");
      const { scrapeAccurateKTCData } = await import('./scripts/accurate-ktc-scraper');
      const result = await scrapeAccurateKTCData();
      res.json({
        message: "Accurate KTC scrape completed successfully",
        ...result
      });
    } catch (error) {
      console.error("Error during accurate KTC scrape:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to complete accurate KTC scrape" 
      });
    }
  });

  // Data Cache Management Routes
  app.get("/api/data-cache/status", async (req, res) => {
    try {
      const { dataCacheService } = await import('./services/data-cache');
      const stats = await dataCacheService.getDataStats();
      res.json(stats);
    } catch (error) {
      console.error("Data cache status error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to get cache status" 
      });
    }
  });

  app.post("/api/data-cache/refresh", async (req, res) => {
    try {
      const { dataCacheService } = await import('./services/data-cache');
      const results = await dataCacheService.refreshAllData();
      res.json({ 
        message: "Data cache refreshed", 
        results 
      });
    } catch (error) {
      console.error("Data cache refresh error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to refresh data cache" 
      });
    }
  });

  app.post("/api/data-cache/refresh/sleeper", async (req, res) => {
    try {
      const { dataCacheService } = await import('./services/data-cache');
      const result = await dataCacheService.refreshSleeperPlayers();
      res.json({ 
        message: "Sleeper data refreshed", 
        result 
      });
    } catch (error) {
      console.error("Sleeper refresh error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to refresh Sleeper data" 
      });
    }
  });

  app.post("/api/data-cache/refresh/ktc", async (req, res) => {
    try {
      const { dataCacheService } = await import('./services/data-cache');
      const result = await dataCacheService.refreshKTCData();
      res.json({ 
        message: "KTC data refreshed", 
        result 
      });
    } catch (error) {
      console.error("KTC data refresh error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to refresh KTC data" 
      });
    }
  });

  // Mock Draft Management Routes
  app.get("/api/mock-drafts/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const mockDrafts = await storage.getMockDraftsByUser(userId);
      res.json(mockDrafts);
    } catch (error) {
      console.error("Error fetching mock drafts:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch mock drafts" 
      });
    }
  });

  app.get("/api/mock-drafts/:mockDraftId/picks", async (req, res) => {
    try {
      const { mockDraftId } = req.params;
      const picks = await storage.getMockDraftPicks(mockDraftId);
      res.json(picks);
    } catch (error) {
      console.error("Error fetching mock draft picks:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch mock draft picks" 
      });
    }
  });

  app.post("/api/mock-drafts", async (req, res) => {
    try {
      const mockDraftData = insertMockDraftSchema.parse(req.body);
      const mockDraft = await storage.createMockDraft(mockDraftData);
      res.json(mockDraft);
    } catch (error) {
      console.error("Error creating mock draft:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to create mock draft" 
      });
    }
  });

  app.put("/api/mock-drafts/:mockDraftId", async (req, res) => {
    try {
      const { mockDraftId } = req.params;
      const updates = req.body;
      const mockDraft = await storage.updateMockDraft(mockDraftId, updates);
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

  app.post("/api/mock-drafts/:mockDraftId/picks", async (req, res) => {
    try {
      const { mockDraftId } = req.params;
      const pickData = insertMockDraftPickSchema.parse({
        ...req.body,
        mock_draft_id: mockDraftId
      });
      const pick = await storage.addMockDraftPick(pickData);
      res.json(pick);
    } catch (error) {
      console.error("Error adding mock draft pick:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to add mock draft pick" 
      });
    }
  });

  app.get("/api/mock-drafts/picks/slot", async (req, res) => {
    try {
      const { round, pick } = req.query;
      if (!round || !pick) {
        return res.status(400).json({ message: "Round and pick parameters required" });
      }
      const picks = await storage.getPicksBySlot(parseInt(round as string), parseInt(pick as string));
      res.json(picks);
    } catch (error) {
      console.error("Error fetching slot picks:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch slot picks" 
      });
    }
  });

  // Player Management Routes
  app.get("/api/players", async (req, res) => {
    try {
      const { position, team, search, available } = req.query;
      let players = await storage.getAllPlayers();

      // Filter for dynasty players with KTC values (our accurate scraped data)
      players = players.filter(p => 
        p.position &&
        ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
        p.ktc_value && 
        p.ktc_value > 0 &&
        p.first_name && 
        p.last_name
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

      // Sort by KTC value (highest first) for better draft recommendations
      players.sort((a, b) => (b.ktc_value || 0) - (a.ktc_value || 0));

      // No KTC enrichment needed - we have perfect cached data!
      // This dramatically improves loading speed

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
