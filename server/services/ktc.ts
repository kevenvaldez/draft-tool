import axios from 'axios';
import * as cheerio from 'cheerio';

export interface KTCPlayer {
  name: string;
  position: string;
  team: string;
  value: number;
  rank: number;
  overallRank: number;
}

export interface KTCRankings {
  players: KTCPlayer[];
  lastUpdated: Date;
}

export class KTCService {
  private rankings: KTCRankings | null = null;
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private async scrapeRankings(format: 'superflex' | '1qb' = 'superflex'): Promise<KTCPlayer[]> {
    try {
      const allPlayers: KTCPlayer[] = [];
      let currentPage = 1;
      const maxPages = 10; // KTC typically has about 10 pages for 500 players
      
      while (currentPage <= maxPages) {
        const url = `https://keeptradecut.com/dynasty-rankings?format=${format}&page=${currentPage}`;
        console.log(`Fetching KTC page ${currentPage}...`);
        
        const response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }
        });

        const $ = cheerio.load(response.data);
        const pagePlayersCount = $('.onePlayer, .player-row, [data-player]').length;
        
        console.log(`Page ${currentPage}: Response status ${response.status}, found ${pagePlayersCount} player elements`);
        
        // If no players found on this page, we've reached the end
        if (pagePlayersCount === 0) {
          console.log(`No more players found on page ${currentPage}, stopping pagination.`);
          break;
        }
        
        const pageStartRank = (currentPage - 1) * 50 + 1;

        // Look for player rows in the rankings table for this page
        $('.onePlayer, .player-row, [data-player]').each((index, element) => {
          const $element = $(element);
          
          // Try multiple selectors to find player info
          let rawName = $element.find('.player-name, .name, .playerName').text().trim() ||
                       $element.find('[data-name]').attr('data-name') ||
                       $element.text().split('\n')[0]?.trim();
          
          // Parse the name which often contains team and position info concatenated
          // Format: "Player NameTEAM" or "Player NameTEAMPOSITION"
          let name = rawName;
          let team = '';
          let position = '';

          if (rawName) {
            // Extract team (usually 3 letters at the end, before position info)
            const teamMatch = rawName.match(/([A-Z]{2,4})(?:[A-Z]{1,2}\d*.*)?$/);
            if (teamMatch) {
              team = teamMatch[1];
              name = rawName.replace(teamMatch[0], '').trim();
            }

            // Try to extract position from the remaining text
            const posMatch = $element.find('.position, .pos').text().trim() ||
                            $element.find('[data-position]').attr('data-position') ||
                            rawName.match(/([A-Z]{1,2}\d*)[\d\s\.y\.o\.Tier]*$/)?.[1] || '';
            
            position = posMatch;
          }

          // Get explicit team and position if available
          const explicitTeam = $element.find('.team, .tm').text().trim() ||
                             $element.find('[data-team]').attr('data-team');
          
          const explicitPosition = $element.find('.position, .pos').text().trim() ||
                                 $element.find('[data-position]').attr('data-position');
          
          // Use explicit values if available, otherwise use parsed values
          if (explicitTeam) team = explicitTeam;
          if (explicitPosition) position = explicitPosition;

          const valueText = $element.find('.value, .ktc-value, [data-value]').text().trim() ||
                           $element.find('[data-value]').attr('data-value');
          
          if (name && name.length > 1) {
            const value = parseInt(valueText.replace(/[^\d]/g, '')) || 0;
            
            // Clean up the position to extract just the position part
            const cleanPosition = position.replace(/[\d\s\.y\.o\.Tier]+.*$/, '').trim();
            
            const overallRank = pageStartRank + index;
            
            allPlayers.push({
              name: name.trim(),
              position: cleanPosition || position,
              team: team.trim(),
              value,
              rank: index + 1, // Rank within page
              overallRank: overallRank
            });
          }
        });
        
        console.log(`Page ${currentPage}: Found ${pagePlayersCount} players`);
        
        // Add a small delay between requests to be respectful
        if (currentPage < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        currentPage++;
      }

      console.log(`KTC scraping completed: ${allPlayers.length} total players found`);
      return allPlayers;
    } catch (error) {
      console.error('KTC scraping error:', error);
      throw new Error(`Failed to fetch KTC rankings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRankings(forceRefresh: boolean = false): Promise<KTCRankings> {
    const now = new Date();
    
    // Return cached data if available and fresh
    if (!forceRefresh && this.rankings && this.lastFetch && 
        (now.getTime() - this.lastFetch.getTime()) < this.CACHE_DURATION) {
      return this.rankings;
    }

    try {
      const players = await this.scrapeRankings();
      
      this.rankings = {
        players,
        lastUpdated: now
      };
      this.lastFetch = now;
      
      return this.rankings;
    } catch (error) {
      // If we have cached data, return it with error warning
      if (this.rankings) {
        console.warn('KTC fetch failed, returning cached data:', error);
        return this.rankings;
      }
      throw error;
    }
  }

  async getPlayerValue(playerName: string, position?: string): Promise<number | null> {
    try {
      const rankings = await this.getRankings();
      
      // First try exact match
      let player = rankings.players.find(p => 
        p.name.toLowerCase() === playerName.toLowerCase()
      );
      
      // If no exact match, try partial match but be more careful
      if (!player) {
        const nameParts = playerName.toLowerCase().split(' ');
        player = rankings.players.find(p => {
          const ktcNameParts = p.name.toLowerCase().split(' ');
          
          // Must match first and last name parts
          if (nameParts.length >= 2 && ktcNameParts.length >= 2) {
            const firstNameMatch = ktcNameParts.some(part => part.includes(nameParts[0]));
            const lastNameMatch = ktcNameParts.some(part => part.includes(nameParts[nameParts.length - 1]));
            
            // Also check position if provided
            const positionMatch = !position || p.position.toUpperCase().includes(position.toUpperCase());
            
            return firstNameMatch && lastNameMatch && positionMatch;
          }
          
          return false;
        });
      }
      
      return player ? player.value : null;
    } catch (error) {
      console.error('Error getting player value:', error);
      return null;
    }
  }

  async searchPlayers(query: string): Promise<KTCPlayer[]> {
    try {
      const rankings = await this.getRankings();
      const lowercaseQuery = query.toLowerCase();
      
      return rankings.players.filter(player =>
        player.name.toLowerCase().includes(lowercaseQuery) ||
        player.team.toLowerCase().includes(lowercaseQuery) ||
        player.position.toLowerCase().includes(lowercaseQuery)
      );
    } catch (error) {
      console.error('Error searching KTC players:', error);
      return [];
    }
  }

  getLastUpdated(): Date | null {
    return this.rankings?.lastUpdated || null;
  }
}

export const ktcService = new KTCService();
