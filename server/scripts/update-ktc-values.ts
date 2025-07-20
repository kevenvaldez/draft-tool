import { db } from '../db';
import { players } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { dynastyValues } from '../services/ktc-values';

export async function updateAllKTCValues() {
  console.log('Starting bulk KTC value update...');
  let updatedCount = 0;

  for (const playerValue of dynastyValues) {
    try {
      // Find matching players in database
      const [player] = await db
        .select()
        .from(players)
        .where(
          and(
            eq(players.first_name, playerValue.firstName),
            eq(players.last_name, playerValue.lastName),
            eq(players.position, playerValue.position)
          )
        )
        .limit(1);

      if (player) {
        // Update the player's KTC value
        await db
          .update(players)
          .set({ ktc_value: playerValue.value })
          .where(eq(players.id, player.id));
        
        updatedCount++;
        console.log(`Updated ${playerValue.firstName} ${playerValue.lastName} (${playerValue.position}) = ${playerValue.value}`);
      } else {
        console.log(`No match found for ${playerValue.firstName} ${playerValue.lastName} (${playerValue.position})`);
      }
    } catch (error) {
      console.error(`Error updating ${playerValue.firstName} ${playerValue.lastName}:`, error);
    }
  }

  console.log(`KTC value update complete. Updated ${updatedCount} players.`);
  return updatedCount;
}

// Run if called directly
if (require.main === module) {
  updateAllKTCValues()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error updating KTC values:', error);
      process.exit(1);
    });
}