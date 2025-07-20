import * as cron from 'node-cron';
import { db } from '../db';
import { data_cache, players } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { sleeperService } from './sleeper';
import { ktcService } from './ktc';

export class DataCacheService {
  private static instance: DataCacheService;
  private cronJob: cron.ScheduledTask | null = null;

  private constructor() {}

  static getInstance(): DataCacheService {
    if (!DataCacheService.instance) {
      DataCacheService.instance = new DataCacheService();
    }
    return DataCacheService.instance;
  }

  async initializeCronJobs() {
    // Schedule daily data refresh at midnight (0 0 * * *)
    this.cronJob = cron.schedule('0 0 * * *', async () => {
      console.log('Starting scheduled daily data refresh...');
      await this.refreshAllData();
    }, {
      scheduled: true,
      timezone: "America/New_York" // Adjust timezone as needed
    });

    console.log('Data cache cron job initialized - will run daily at midnight');
  }

  async stopCronJobs() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }

  async getCacheStatus(cacheKey: string) {
    const [cache] = await db.select().from(data_cache).where(eq(data_cache.cache_key, cacheKey));
    return cache;
  }

  async updateCacheStatus(cacheKey: string, status: 'active' | 'updating' | 'failed', dataCount?: number, metadata?: any) {
    const existingCache = await this.getCacheStatus(cacheKey);
    
    if (existingCache) {
      await db.update(data_cache)
        .set({
          status,
          last_updated: new Date(),
          data_count: dataCount ?? existingCache.data_count,
          metadata: metadata ? JSON.stringify(metadata) : existingCache.metadata
        })
        .where(eq(data_cache.cache_key, cacheKey));
    } else {
      await db.insert(data_cache).values({
        cache_key: cacheKey,
        status,
        data_count: dataCount ?? 0,
        metadata: metadata ? JSON.stringify(metadata) : null
      });
    }
  }

  async isDataStale(cacheKey: string, maxAgeHours: number = 24): Promise<boolean> {
    const cache = await this.getCacheStatus(cacheKey);
    
    if (!cache) return true;
    if (cache.status === 'failed') return true;
    
    const ageHours = (Date.now() - cache.last_updated.getTime()) / (1000 * 60 * 60);
    return ageHours > maxAgeHours;
  }

  async refreshSleeperPlayers(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      console.log('Refreshing Sleeper player data...');
      await this.updateCacheStatus('sleeper_players', 'updating');

      const players = await sleeperService.getAllPlayers();
      const playerArray = Object.values(players);
      
      // Filter for active NFL players
      const activeNFLPlayers = playerArray
        .filter(p => 
          p.player_id && 
          p.position && 
          ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position) &&
          p.team && 
          p.team !== 'FA' && 
          p.status === 'Active'
        )
        .slice(0, 1000); // Increased limit

      // Use simple insert/update approach without onConflictDoUpdate
      let upsertCount = 0;
      for (const player of activeNFLPlayers) {
        try {
          // Use simpler approach - just try insert and catch conflict
          try {
            await db.insert(players).values({
              id: player.player_id,
              first_name: player.first_name || null,
              last_name: player.last_name || null,
              position: player.position || null,
              team: player.team || null,
              age: player.age || null,
              years_exp: player.years_exp || null,
              height: player.height || null,
              weight: player.weight || null,
              status: player.status || null,
              injury_status: player.injury_status || null,
              updated_at: new Date()
            });
          } catch (insertError) {
            // If insert fails due to conflict, try update
            await db.update(players)
              .set({
                first_name: player.first_name || null,
                last_name: player.last_name || null,
                position: player.position || null,
                team: player.team || null,
                age: player.age || null,
                years_exp: player.years_exp || null,
                height: player.height || null,
                weight: player.weight || null,
                status: player.status || null,
                injury_status: player.injury_status || null,
                updated_at: new Date()
              })
              .where(eq(players.id, player.player_id));
          }
          upsertCount++;
        } catch (error) {
          console.warn(`Failed to upsert player ${player.player_id}:`, error instanceof Error ? error.message : error);
          continue;
        }
      }
      
      console.log(`Successfully upserted ${upsertCount} players from Sleeper API`);

      await this.updateCacheStatus('sleeper_players', 'active', activeNFLPlayers.length, {
        last_refresh: new Date().toISOString(),
        source: 'sleeper_api'
      });

      console.log(`Successfully refreshed ${activeNFLPlayers.length} Sleeper players`);
      return { success: true, count: activeNFLPlayers.length };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to refresh Sleeper players:', errorMessage);
      
      await this.updateCacheStatus('sleeper_players', 'failed', 0, {
        error: errorMessage,
        failed_at: new Date().toISOString()
      });

      return { success: false, count: 0, error: errorMessage };
    }
  }

  async refreshKTCData(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      console.log('Refreshing KTC player rankings...');
      await this.updateCacheStatus('ktc_rankings', 'updating');

      const ktcRankings = await ktcService.getRankings(true); // Force refresh

      // Update players with KTC values using name matching
      let ktcUpdateCount = 0;
      for (const ktcPlayer of ktcRankings.players) {
        try {
          // Get all players and match by name similarity in application code
          const allPlayers = await db.select().from(players);
          const matchingPlayers = allPlayers.filter(player => {
            const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
            const ktcName = ktcPlayer.name.toLowerCase();
            return fullName.includes(ktcName) || ktcName.includes(fullName);
          });
          
          for (const player of matchingPlayers) {
            await db.update(players)
              .set({
                ktc_value: ktcPlayer.value,
                ktc_rank: ktcPlayer.overallRank,
                updated_at: new Date()
              })
              .where(eq(players.id, player.id));
            ktcUpdateCount++;
          }
        } catch (error) {
          console.warn(`Failed to update KTC data for ${ktcPlayer.name}:`, error instanceof Error ? error.message : error);
          continue;
        }
      }
      
      console.log(`Updated KTC values for ${ktcUpdateCount} player records`);

      await this.updateCacheStatus('ktc_rankings', 'active', ktcRankings.players.length, {
        last_refresh: new Date().toISOString(),
        source: 'keeptradecut'
      });

      console.log(`Successfully refreshed KTC rankings for ${ktcRankings.players.length} players`);
      return { success: true, count: ktcRankings.players.length };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to refresh KTC data:', errorMessage);
      
      await this.updateCacheStatus('ktc_rankings', 'failed', 0, {
        error: errorMessage,
        failed_at: new Date().toISOString()
      });

      return { success: false, count: 0, error: errorMessage };
    }
  }

  async refreshAllData(): Promise<{ sleeper: any; ktc: any }> {
    console.log('Starting comprehensive data refresh...');
    
    const [sleeperResult, ktcResult] = await Promise.allSettled([
      this.refreshSleeperPlayers(),
      this.refreshKTCData()
    ]);

    const results = {
      sleeper: sleeperResult.status === 'fulfilled' ? sleeperResult.value : { success: false, error: sleeperResult.reason },
      ktc: ktcResult.status === 'fulfilled' ? ktcResult.value : { success: false, error: ktcResult.reason }
    };

    console.log('Data refresh completed:', results);
    return results;
  }

  async ensureDataIsCurrent(): Promise<boolean> {
    const sleeperStale = await this.isDataStale('sleeper_players', 24);
    const ktcStale = await this.isDataStale('ktc_rankings', 24);

    if (sleeperStale || ktcStale) {
      console.log('Data is stale, refreshing...');
      await this.refreshAllData();
      return false; // Was stale, now refreshed
    }

    return true; // Data was current
  }

  async getDataStats() {
    const cacheStats = await db.select().from(data_cache);
    const playerCount = await db.select({ count: sql<number>`count(*)` }).from(players);
    
    return {
      caches: cacheStats,
      total_players: playerCount[0].count,
      timestamp: new Date().toISOString()
    };
  }
}

export const dataCacheService = DataCacheService.getInstance();