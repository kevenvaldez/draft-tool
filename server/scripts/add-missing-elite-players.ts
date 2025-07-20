import { db } from '../db';
import { players } from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';

// Elite dynasty players that should be at the top
const elitePlayers = [
  // Elite QBs
  { firstName: 'Josh', lastName: 'Allen', position: 'QB', team: 'BUF', value: 9500 },
  { firstName: 'Lamar', lastName: 'Jackson', position: 'QB', team: 'BAL', value: 9200 },
  { firstName: 'Patrick', lastName: 'Mahomes', position: 'QB', team: 'KC', value: 9000 },
  { firstName: 'C.J.', lastName: 'Stroud', position: 'QB', team: 'HOU', value: 8500 },
  { firstName: 'Caleb', lastName: 'Williams', position: 'QB', team: 'CHI', value: 8200 },
  { firstName: 'Jayden', lastName: 'Daniels', position: 'QB', team: 'WAS', value: 8000 },
  { firstName: 'Anthony', lastName: 'Richardson', position: 'QB', team: 'IND', value: 7800 },
  { firstName: 'Brock', lastName: 'Purdy', position: 'QB', team: 'SF', value: 7600 },
  { firstName: 'Drake', lastName: 'Maye', position: 'QB', team: 'NE', value: 7400 },
  { firstName: 'Bo', lastName: 'Nix', position: 'QB', team: 'DEN', value: 7200 },

  // Elite RBs  
  { firstName: 'Breece', lastName: 'Hall', position: 'RB', team: 'NYJ', value: 9800 },
  { firstName: 'Bijan', lastName: 'Robinson', position: 'RB', team: 'ATL', value: 9500 },
  { firstName: 'Jahmyr', lastName: 'Gibbs', position: 'RB', team: 'DET', value: 9200 },
  { firstName: 'Jonathan', lastName: 'Taylor', position: 'RB', team: 'IND', value: 8800 },
  { firstName: 'Saquon', lastName: 'Barkley', position: 'RB', team: 'PHI', value: 8500 },
  { firstName: 'Kenneth', lastName: 'Walker III', position: 'RB', team: 'SEA', value: 8200 },
  { firstName: 'Kyren', lastName: 'Williams', position: 'RB', team: 'LAR', value: 8000 },
  { firstName: 'De\'Von', lastName: 'Achane', position: 'RB', team: 'MIA', value: 7800 },
  { firstName: 'Derrick', lastName: 'Henry', position: 'RB', team: 'BAL', value: 7600 },
  { firstName: 'Josh', lastName: 'Jacobs', position: 'RB', team: 'GB', value: 7400 },

  // Elite WRs
  { firstName: 'CeeDee', lastName: 'Lamb', position: 'WR', team: 'DAL', value: 10000 },
  { firstName: 'Ja\'Marr', lastName: 'Chase', position: 'WR', team: 'CIN', value: 9800 },
  { firstName: 'Amon-Ra', lastName: 'St. Brown', position: 'WR', team: 'DET', value: 9500 },
  { firstName: 'Justin', lastName: 'Jefferson', position: 'WR', team: 'MIN', value: 9200 },
  { firstName: 'Jaylen', lastName: 'Waddle', position: 'WR', team: 'MIA', value: 9000 },
  { firstName: 'A.J.', lastName: 'Brown', position: 'WR', team: 'PHI', value: 8800 },
  { firstName: 'DK', lastName: 'Metcalf', position: 'WR', team: 'SEA', value: 8600 },
  { firstName: 'Tyreek', lastName: 'Hill', position: 'WR', team: 'MIA', value: 8400 },
  { firstName: 'Davante', lastName: 'Adams', position: 'WR', team: 'LV', value: 8200 },
  { firstName: 'Cooper', lastName: 'Kupp', position: 'WR', team: 'LAR', value: 8000 },
  { firstName: 'Puka', lastName: 'Nacua', position: 'WR', team: 'LAR', value: 7800 },
  { firstName: 'Garrett', lastName: 'Wilson', position: 'WR', team: 'NYJ', value: 7600 },
  { firstName: 'Chris', lastName: 'Olave', position: 'WR', team: 'NO', value: 7400 },
  { firstName: 'Deebo', lastName: 'Samuel', position: 'WR', team: 'SF', value: 7200 },
  { firstName: 'Mike', lastName: 'Evans', position: 'WR', team: 'TB', value: 7000 }
];

export async function addMissingElitePlayers() {
  console.log('Adding/updating missing elite players...');
  
  let updatedCount = 0;
  let addedCount = 0;
  
  for (const player of elitePlayers) {
    try {
      // First, try to find existing player by flexible name matching
      const allPlayers = await db.select().from(players);
      
      let existingPlayer = null;
      
      // Try various matching strategies
      for (const existing of allPlayers) {
        const existingFullName = `${existing.first_name} ${existing.last_name}`.toLowerCase();
        const targetFullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        
        // Exact match
        if (existingFullName === targetFullName && existing.position === player.position) {
          existingPlayer = existing;
          break;
        }
        
        // Partial match for names with variations
        if (existing.position === player.position) {
          const firstNameMatch = existingFullName.includes(player.firstName.toLowerCase()) || 
                                 player.firstName.toLowerCase().includes(existing.first_name.toLowerCase());
          const lastNameMatch = existingFullName.includes(player.lastName.toLowerCase()) || 
                                player.lastName.toLowerCase().includes(existing.last_name.toLowerCase());
          
          if (firstNameMatch && lastNameMatch) {
            existingPlayer = existing;
            break;
          }
        }
        
        // Team-based matching for unique names
        if (existing.position === player.position && existing.team === player.team) {
          if (existingFullName.includes(player.firstName.toLowerCase().split(' ')[0]) ||
              existingFullName.includes(player.lastName.toLowerCase().split(' ')[0])) {
            existingPlayer = existing;
            break;
          }
        }
      }
      
      if (existingPlayer) {
        // Update existing player
        await db
          .update(players)
          .set({
            first_name: player.firstName,
            last_name: player.lastName,
            position: player.position,
            team: player.team,
            ktc_value: player.value
          })
          .where(eq(players.id, existingPlayer.id));
        
        updatedCount++;
        console.log(`Updated: ${player.firstName} ${player.lastName} (${player.position}) ${player.team} - ${player.value}`);
      } else {
        // Add new player
        const newId = `elite_${Date.now()}_${addedCount}`;
        await db.insert(players).values({
          id: newId,
          first_name: player.firstName,
          last_name: player.lastName,
          position: player.position,
          team: player.team,
          status: 'Active',
          ktc_value: player.value
        });
        
        addedCount++;
        console.log(`Added: ${player.firstName} ${player.lastName} (${player.position}) ${player.team} - ${player.value}`);
      }
      
    } catch (error) {
      console.error(`Error processing ${player.firstName} ${player.lastName}:`, error);
    }
  }
  
  console.log(`Elite player update complete: ${updatedCount} updated, ${addedCount} added`);
  return { updatedCount, addedCount };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addMissingElitePlayers()
    .then((result) => {
      console.log('Elite player addition completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Elite player addition failed:', error);
      process.exit(1);
    });
}