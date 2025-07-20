import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '../db';
import { players } from '@shared/schema';

interface ScrapedPlayer {
  name: string;
  position: string;
  team: string;
  value: number;
  rank: number;
}

export async function clearAndRescrapeKTC() {
  console.log('Starting fresh KTC scrape for top 500 superflex PPR players...');
  
  // Clear existing player data
  console.log('Clearing existing player data...');
  await db.delete(players);
  console.log('Player data cleared.');

  const allPlayers: ScrapedPlayer[] = [];
  let currentPage = 1;
  const maxPages = 10; // Should get us 500 players
  
  try {
    while (currentPage <= maxPages && allPlayers.length < 500) {
      const url = `https://keeptradecut.com/dynasty-rankings?format=superflex&page=${currentPage}`;
      console.log(`Fetching KTC superflex page ${currentPage}...`);
      
      const response = await axios.get(url, {
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        }
      });

      const $ = cheerio.load(response.data);
      
      // More comprehensive selector approach for KTC elements
      const playerElements = $('.onePlayer, .player-item, [data-player-id], .dynasty-player-row, tr[data-player], .player-row');
      
      console.log(`Page ${currentPage}: Found ${playerElements.length} player elements`);
      
      if (playerElements.length === 0) {
        // Try alternative selectors if primary ones fail
        const alternativeElements = $('*').filter(function() {
          const text = $(this).text();
          return text.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) && 
                 text.match(/QB|RB|WR|TE/) && 
                 text.match(/[0-9]{2,4}/);
        });
        
        console.log(`Page ${currentPage}: Trying alternative selectors, found ${alternativeElements.length} elements`);
        
        if (alternativeElements.length === 0) {
          console.log(`No players found on page ${currentPage}, stopping.`);
          break;
        }
      }

      playerElements.each((index, element) => {
        try {
          const $element = $(element);
          
          // Extract player information using multiple strategies
          let playerName = '';
          let position = '';
          let team = '';
          let value = 0;
          
          // Strategy 1: Look for specific data attributes
          playerName = $element.attr('data-player-name') || 
                      $element.find('[data-player-name]').attr('data-player-name') || '';
          
          // Strategy 2: Look for text content in specific classes
          if (!playerName) {
            const nameElement = $element.find('.player-name, .name, .playerName, .player-text, .player-info');
            playerName = nameElement.first().text().trim();
          }
          
          // Strategy 3: Parse from element text if no specific name found
          if (!playerName) {
            const fullText = $element.text().trim();
            const nameMatch = fullText.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
            if (nameMatch) {
              playerName = nameMatch[1];
            }
          }
          
          // Extract position
          position = $element.find('.position, .pos, [data-position]').text().trim() ||
                    $element.attr('data-position') || '';
          
          if (!position) {
            const posMatch = $element.text().match(/\b(QB|RB|WR|TE)\b/);
            if (posMatch) position = posMatch[1];
          }
          
          // Extract team
          team = $element.find('.team, .tm, [data-team]').text().trim() ||
                $element.attr('data-team') || '';
          
          if (!team) {
            const teamMatch = $element.text().match(/\b([A-Z]{2,4})\b/);
            if (teamMatch && teamMatch[1] !== position) {
              team = teamMatch[1];
            }
          }
          
          // Extract value - this is crucial for accurate rankings
          const valueElement = $element.find('.value, .ktc-value, .price, .score, [data-value]');
          const valueText = valueElement.text().trim() || $element.attr('data-value') || '';
          
          if (valueText) {
            // Extract numeric value, handling various formats
            const numMatch = valueText.match(/([0-9,]+)/);
            if (numMatch) {
              value = parseInt(numMatch[1].replace(/,/g, ''));
            }
          }
          
          // If no value found in specific elements, try parsing from full text
          if (!value) {
            const fullText = $element.text();
            const valueMatches = fullText.match(/\b([1-9][0-9]{3,4})\b/g);
            if (valueMatches) {
              // Take the largest number as the value (likely the KTC score)
              value = Math.max(...valueMatches.map(v => parseInt(v)));
            }
          }
          
          // Clean up the data
          if (playerName && position && value > 0) {
            // Clean player name - remove team/position suffixes
            playerName = playerName.replace(/\s+(QB|RB|WR|TE).*$/, '').trim();
            playerName = playerName.replace(/\s+[A-Z]{2,4}$/, '').trim();
            
            // Ensure value is within reasonable bounds for KTC (max 10,000)
            if (value > 10000) {
              value = Math.floor(value / 10); // Adjust if values are inflated
            }
            
            const rank = allPlayers.length + 1;
            
            allPlayers.push({
              name: playerName,
              position: position.toUpperCase(),
              team: team.toUpperCase(),
              value,
              rank
            });
            
            console.log(`Found: ${playerName} (${position}) ${team} - ${value}`);
          }
        } catch (error) {
          console.error('Error parsing player element:', error);
        }
      });
      
      console.log(`Page ${currentPage}: Processed ${allPlayers.length} total players so far`);
      
      // Add delay between requests
      if (currentPage < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      currentPage++;
    }
    
    console.log(`\nScraping complete! Found ${allPlayers.length} players`);
    
    // Insert players into database
    console.log('Inserting players into database...');
    let insertedCount = 0;
    
    for (const player of allPlayers) {
      try {
        // Split name into first and last
        const nameParts = player.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await db.insert(players).values({
          id: `ktc_${player.rank}`,
          first_name: firstName,
          last_name: lastName,
          position: player.position,
          team: player.team || null,
          status: 'Active',
          ktc_value: player.value
        });
        
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting ${player.name}:`, error);
      }
    }
    
    console.log(`Successfully inserted ${insertedCount} players into database`);
    
    // Show top 10 players as verification
    console.log('\nTop 10 players by KTC value:');
    const topPlayers = allPlayers
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    topPlayers.forEach((player, index) => {
      console.log(`${index + 1}. ${player.name} (${player.position}) ${player.team} - ${player.value}`);
    });
    
    return {
      totalScraped: allPlayers.length,
      totalInserted: insertedCount,
      topPlayers: topPlayers.slice(0, 5)
    };
    
  } catch (error) {
    console.error('Error during KTC scraping:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  clearAndRescrapeKTC()
    .then((result) => {
      console.log('Scraping completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}