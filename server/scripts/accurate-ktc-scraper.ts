import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '../db';
import { players } from '@shared/schema';
import { sql } from 'drizzle-orm';

interface ScrapedPlayer {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string;
  ktc_value: number;
  ktc_rank: number;
}

export async function scrapeAccurateKTCData(): Promise<{ 
  totalScraped: number; 
  totalInserted: number; 
  topPlayers: any[] 
}> {
  console.log('Starting accurate KTC scraper with correct URL format...');
  
  const allPlayers: ScrapedPlayer[] = [];
  let currentPage = 0;
  const maxPages = 12;
  
  try {
    while (currentPage < maxPages) {
      const url = `https://keeptradecut.com/dynasty-rankings?page=${currentPage}&filters=QB|WR|RB|TE|RDP&format=2`;
      console.log(`Fetching KTC page ${currentPage}...`);
      
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (response.status !== 200) {
        console.log(`Page ${currentPage}: HTTP ${response.status}, skipping`);
        currentPage++;
        continue;
      }

      const $ = cheerio.load(response.data);
      
      // Look for script tags that might contain player data (KTC often uses JSON in scripts)
      let jsonData = null;
      $('script').each((i, script) => {
        const scriptContent = $(script).html();
        if (scriptContent && (scriptContent.includes('playerValues') || scriptContent.includes('rankings'))) {
          try {
            // Try to extract JSON data from script tags
            const jsonMatch = scriptContent.match(/(?:playerValues|rankings|playerData)\s*[:=]\s*(\[.*?\])/);
            if (jsonMatch) {
              jsonData = JSON.parse(jsonMatch[1]);
            }
          } catch (e) {
            // Continue if JSON parsing fails
          }
        }
      });

      let pagePlayerCount = 0;
      
      // If we found JSON data, use it
      if (jsonData && Array.isArray(jsonData)) {
        console.log(`Page ${currentPage}: Found JSON data with ${jsonData.length} players`);
        (jsonData as any[]).forEach((playerData: any, index: number) => {
          if (playerData.name || playerData.player_name) {
            const fullName = playerData.name || playerData.player_name || '';
            const nameParts = fullName.trim().split(' ');
            
            const player: ScrapedPlayer = {
              id: `accurate_ktc_${currentPage * 50 + index + 1}`,
              name: fullName.trim(),
              first_name: nameParts[0] || '',
              last_name: nameParts.slice(1).join(' ') || '',
              position: playerData.position || playerData.pos || '',
              team: playerData.team || '',
              ktc_value: Math.min(playerData.value || 0, 10000),
              ktc_rank: currentPage * 50 + index + 1
            };
            
            if (player.name && player.position) {
              allPlayers.push(player);
              pagePlayerCount++;
            }
          }
        });
      } else {
        // Fallback to HTML parsing
        const playerElements = $('.onePlayer, .player-row, tr[data-player-id], .ranking-player').toArray();
        console.log(`Page ${currentPage}: Found ${playerElements.length} HTML player elements`);
        
        playerElements.forEach((element, index) => {
          const $el = $(element);
          
          // Try different selectors for name
          let fullName = $el.find('.player-name, .name, h3, .playerName').first().text().trim();
          
          // Try data attributes
          if (!fullName) {
            fullName = $el.attr('data-player') || $el.attr('data-name') || '';
          }
          
          // Try finding name in child elements
          if (!fullName) {
            const nameEl = $el.find('*').filter(function() {
              const text = $(this).text().trim();
              return text.length > 3 && text.length < 40 && /^[A-Za-z\s\.\']+$/.test(text);
            }).first();
            fullName = nameEl.text().trim();
          }
          
          if (fullName && fullName.length > 2) {
            // Clean up the name - remove team/position suffixes
            fullName = fullName.replace(/[A-Z]{2,4}$/, '').trim(); // Remove team codes
            fullName = fullName.replace(/(?:QB|RB|WR|TE)\d*.*$/, '').trim(); // Remove position info
            
            const nameParts = fullName.split(' ');
            
            // Extract position and team
            let position = $el.find('.position, .pos').text().trim().replace(/\d+.*/, '') || 
                          $el.attr('data-position') || '';
            let team = $el.find('.team, .tm').text().trim() || $el.attr('data-team') || '';
            
            // Extract value - look for numbers
            let value = 0;
            const valueText = $el.find('.value, .points, .score').text().trim() || 
                             $el.attr('data-value') || '';
            if (valueText) {
              const valueMatch = valueText.match(/(\d+)/);
              value = valueMatch ? Math.min(parseInt(valueMatch[1]), 10000) : 0;
            }
            
            const player: ScrapedPlayer = {
              id: `accurate_ktc_${currentPage * 50 + index + 1}`,
              name: fullName,
              first_name: nameParts[0] || '',
              last_name: nameParts.slice(1).join(' ') || '',
              position: position || '',
              team: team || '',
              ktc_value: value,
              ktc_rank: currentPage * 50 + index + 1
            };
            
            if (player.name && player.position) {
              allPlayers.push(player);
              pagePlayerCount++;
            }
          }
        });
      }
      
      console.log(`Page ${currentPage}: Extracted ${pagePlayerCount} players`);
      
      if (pagePlayerCount === 0) {
        console.log(`No players found on page ${currentPage}, stopping pagination`);
        break;
      }
      
      // Respectful delay between requests
      if (currentPage < maxPages - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      currentPage++;
    }
    
    console.log(`Scraping complete! Found ${allPlayers.length} players`);
    
    // Clear old KTC data
    console.log('Clearing old KTC data...');
    await db.delete(players).where(sql`${players.id} LIKE 'accurate_ktc_%'`);
    
    // Insert new data
    console.log('Inserting new KTC data...');
    let insertedCount = 0;
    
    // Calculate position-specific rankings
    const playersByPosition = allPlayers.reduce((acc, player) => {
      if (!acc[player.position]) acc[player.position] = [];
      acc[player.position].push(player);
      return acc;
    }, {} as Record<string, typeof allPlayers>);
    
    // Sort each position by KTC value and assign position ranks
    Object.values(playersByPosition).forEach(positionPlayers => {
      positionPlayers
        .filter(p => p.ktc_value > 0)
        .sort((a, b) => b.ktc_value - a.ktc_value)
        .forEach((player, index) => {
          player.position_rank = index + 1;
        });
    });
    
    for (const player of allPlayers) {
      try {
        await db.insert(players).values({
          id: player.id,
          first_name: player.first_name,
          last_name: player.last_name,
          position: player.position,
          team: player.team || null,
          ktc_value: player.ktc_value,
          ktc_rank: player.ktc_rank, // Global rank
          position_rank: (player as any).position_rank || null, // Position-specific rank
          status: 'Active',
          age: null,
          years_exp: null,
          height: null,
          weight: null,
          injury_status: null,
          updated_at: new Date()
        });
        insertedCount++;
      } catch (error) {
        console.error(`Failed to insert player ${player.name}:`, error);
      }
    }
    
    // Get top players for verification
    const topPlayers = allPlayers
      .filter(p => p.ktc_value > 0)
      .sort((a, b) => b.ktc_value - a.ktc_value)
      .slice(0, 10);
    
    return {
      totalScraped: allPlayers.length,
      totalInserted: insertedCount,
      topPlayers
    };
    
  } catch (error) {
    console.error('KTC scraping failed:', error);
    throw error;
  }
}