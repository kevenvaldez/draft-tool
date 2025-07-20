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
      const url = `https://keeptradecut.com/dynasty-rankings?format=${format}`;
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
      const players: KTCPlayer[] = [];

      // Look for player rows in the rankings table
      $('.onePlayer, .player-row, [data-player]').each((index, element) => {
        const $element = $(element);
        
        // Try multiple selectors to find player info
        const name = $element.find('.player-name, .name, .playerName').text().trim() ||
                    $element.find('[data-name]').attr('data-name') ||
                    $element.text().split('\n')[0]?.trim();
        
        const position = $element.find('.position, .pos').text().trim() ||
                        $element.find('[data-position]').attr('data-position');
        
        const team = $element.find('.team, .tm').text().trim() ||
                    $element.find('[data-team]').attr('data-team');
        
        const valueText = $element.find('.value, .ktc-value, [data-value]').text().trim() ||
                         $element.find('[data-value]').attr('data-value');
        
        if (name && position) {
          const value = parseInt(valueText.replace(/[^\d]/g, '')) || 0;
          
          players.push({
            name,
            position,
            team: team || '',
            value,
            rank: index + 1,
            overallRank: index + 1
          });
        }
      });

      // If direct scraping fails, try to find data in script tags
      if (players.length === 0) {
        const scripts = $('script').toArray();
        for (const script of scripts) {
          const content = $(script).html();
          if (content && content.includes('rankings') && content.includes('players')) {
            try {
              // Try to extract JSON data from script content
              const jsonMatch = content.match(/(?:rankings|players)\s*[:=]\s*(\[.*?\])/s);
              if (jsonMatch) {
                const data = JSON.parse(jsonMatch[1]);
                if (Array.isArray(data)) {
                  data.forEach((player, index) => {
                    if (player.name && player.position) {
                      players.push({
                        name: player.name,
                        position: player.position,
                        team: player.team || '',
                        value: player.value || 0,
                        rank: index + 1,
                        overallRank: index + 1
                      });
                    }
                  });
                }
              }
            } catch (e) {
              // Continue trying other scripts
            }
          }
        }
      }

      return players;
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
      const player = rankings.players.find(p => 
        p.name.toLowerCase().includes(playerName.toLowerCase()) ||
        playerName.toLowerCase().includes(p.name.toLowerCase())
      );
      
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
