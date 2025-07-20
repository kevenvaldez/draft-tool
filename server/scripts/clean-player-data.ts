import { db } from '../db';
import { players } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Function to properly parse and clean player names, positions, and teams
export async function cleanPlayerData() {
  console.log('Starting player data cleanup...');
  
  const allPlayers = await db.select().from(players);
  console.log(`Found ${allPlayers.length} players to clean`);
  
  let updatedCount = 0;
  let deletedCount = 0;
  
  for (const player of allPlayers) {
    try {
      let needsUpdate = false;
      let cleanedFirstName = player.first_name;
      let cleanedLastName = player.last_name;
      let cleanedPosition = player.position;
      let cleanedTeam = player.team;
      let cleanedValue = player.ktc_value;
      
      // Handle concatenated names like "Michael Penix Jr.ATL"
      const fullName = `${player.first_name} ${player.last_name}`;
      
      // Extract team from name if it's concatenated (3-4 letter team codes)
      const nameTeamMatch = fullName.match(/^(.+?)([A-Z]{2,4})$/);
      if (nameTeamMatch && !player.team) {
        const cleanName = nameTeamMatch[1].trim();
        const extractedTeam = nameTeamMatch[2];
        
        // Split the clean name into first and last
        const nameParts = cleanName.split(' ');
        if (nameParts.length >= 2) {
          cleanedFirstName = nameParts[0];
          cleanedLastName = nameParts.slice(1).join(' ');
          cleanedTeam = extractedTeam;
          needsUpdate = true;
        }
      }
      
      // Clean position - remove numbers, ages, tiers, etc.
      if (player.position) {
        const positionMatch = player.position.match(/^(QB|RB|WR|TE|PICK)/);
        if (positionMatch) {
          cleanedPosition = positionMatch[1];
          needsUpdate = true;
        }
      }
      
      // Handle draft picks - delete them as they're not actual players
      if (cleanedPosition === 'PICK' || fullName.includes('1st') || fullName.includes('2nd') || fullName.includes('Mid') || fullName.includes('Late')) {
        await db.delete(players).where(eq(players.id, player.id));
        deletedCount++;
        console.log(`Deleted draft pick: ${fullName}`);
        continue;
      }
      
      // Cap values at 10,000
      if (player.ktc_value && player.ktc_value > 10000) {
        cleanedValue = Math.min(10000, player.ktc_value);
        needsUpdate = true;
      }
      
      // Update player if needed
      if (needsUpdate) {
        await db
          .update(players)
          .set({
            first_name: cleanedFirstName,
            last_name: cleanedLastName,
            position: cleanedPosition,
            team: cleanedTeam,
            ktc_value: cleanedValue
          })
          .where(eq(players.id, player.id));
        
        updatedCount++;
        console.log(`Updated: ${cleanedFirstName} ${cleanedLastName} (${cleanedPosition}) ${cleanedTeam} - ${cleanedValue}`);
      }
      
    } catch (error) {
      console.error(`Error processing player ${player.first_name} ${player.last_name}:`, error);
    }
  }
  
  console.log(`Cleanup complete: ${updatedCount} players updated, ${deletedCount} draft picks deleted`);
  return { updatedCount, deletedCount };
}

// Apply manual corrections for top dynasty players to ensure accurate rankings
export async function applyTopPlayerCorrections() {
  console.log('Applying top player corrections...');
  
  const corrections = [
    // Top QBs
    { name: 'Josh Allen', position: 'QB', team: 'BUF', value: 9500 },
    { name: 'Lamar Jackson', position: 'QB', team: 'BAL', value: 9200 },
    { name: 'Patrick Mahomes', position: 'QB', team: 'KC', value: 9000 },
    { name: 'C.J. Stroud', position: 'QB', team: 'HOU', value: 8500 },
    { name: 'Caleb Williams', position: 'QB', team: 'CHI', value: 8200 },
    { name: 'Jayden Daniels', position: 'QB', team: 'WAS', value: 8000 },
    
    // Top RBs
    { name: 'Breece Hall', position: 'RB', team: 'NYJ', value: 9800 },
    { name: 'Bijan Robinson', position: 'RB', team: 'ATL', value: 9500 },
    { name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', value: 9200 },
    { name: 'Jonathan Taylor', position: 'RB', team: 'IND', value: 8800 },
    { name: 'Saquon Barkley', position: 'RB', team: 'PHI', value: 8500 },
    
    // Top WRs  
    { name: 'CeeDee Lamb', position: 'WR', team: 'DAL', value: 10000 },
    { name: "Ja'Marr Chase", position: 'WR', team: 'CIN', value: 9800 },
    { name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', value: 9500 },
    { name: 'Justin Jefferson', position: 'WR', team: 'MIN', value: 9200 },
    { name: 'A.J. Brown', position: 'WR', team: 'PHI', value: 9000 },
    
    // Top TEs
    { name: 'Travis Kelce', position: 'TE', team: 'KC', value: 8000 },
    { name: 'Mark Andrews', position: 'TE', team: 'BAL', value: 7500 },
    { name: 'T.J. Hockenson', position: 'TE', team: 'MIN', value: 7200 },
    { name: 'Kyle Pitts', position: 'TE', team: 'ATL', value: 7000 },
    { name: 'George Kittle', position: 'TE', team: 'SF', value: 6800 }
  ];
  
  let correctedCount = 0;
  
  for (const correction of corrections) {
    try {
      const nameParts = correction.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      // Find player by name and position
      const [player] = await db
        .select()
        .from(players)
        .where(eq(players.position, correction.position))
        .limit(100); // Get multiple players to search through
      
      // Find best match
      let bestMatch = null;
      const allPlayersOfPosition = await db
        .select()
        .from(players)
        .where(eq(players.position, correction.position));
      
      for (const p of allPlayersOfPosition) {
        const playerFullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        const targetName = correction.name.toLowerCase();
        
        if (playerFullName.includes(targetName.split(' ')[0]) && 
            playerFullName.includes(targetName.split(' ').slice(-1)[0])) {
          bestMatch = p;
          break;
        }
      }
      
      if (bestMatch) {
        await db
          .update(players)
          .set({
            first_name: firstName,
            last_name: lastName,
            team: correction.team,
            ktc_value: correction.value
          })
          .where(eq(players.id, bestMatch.id));
        
        correctedCount++;
        console.log(`Corrected: ${correction.name} (${correction.position}) ${correction.team} - ${correction.value}`);
      } else {
        console.log(`No match found for: ${correction.name} (${correction.position})`);
      }
      
    } catch (error) {
      console.error(`Error correcting ${correction.name}:`, error);
    }
  }
  
  console.log(`Applied ${correctedCount} top player corrections`);
  return correctedCount;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.resolve()
    .then(() => cleanPlayerData())
    .then(() => applyTopPlayerCorrections())
    .then(() => {
      console.log('Player data cleanup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}