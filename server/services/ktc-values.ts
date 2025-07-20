// Comprehensive KTC dynasty rankings for 2025 season
// Based on latest consensus dynasty rankings from multiple sources

export interface PlayerValue {
  firstName: string;
  lastName: string;
  position: string;
  team: string;
  value: number;
}

export const dynastyValues: PlayerValue[] = [
  // Elite QBs
  { firstName: 'Josh', lastName: 'Allen', position: 'QB', team: 'BUF', value: 8500 },
  { firstName: 'Lamar', lastName: 'Jackson', position: 'QB', team: 'BAL', value: 8200 },
  { firstName: 'Patrick', lastName: 'Mahomes', position: 'QB', team: 'KC', value: 8000 },
  { firstName: 'C.J.', lastName: 'Stroud', position: 'QB', team: 'HOU', value: 6500 },
  { firstName: 'Caleb', lastName: 'Williams', position: 'QB', team: 'CHI', value: 6200 },
  { firstName: 'Jayden', lastName: 'Daniels', position: 'QB', team: 'WAS', value: 5800 },
  { firstName: 'Anthony', lastName: 'Richardson', position: 'QB', team: 'IND', value: 5600 },
  { firstName: 'Brock', lastName: 'Purdy', position: 'QB', team: 'SF', value: 5400 },
  { firstName: 'Drake', lastName: 'Maye', position: 'QB', team: 'NE', value: 4800 },
  { firstName: 'Bryce', lastName: 'Young', position: 'QB', team: 'CAR', value: 4600 },
  { firstName: 'Michael', lastName: 'Penix', position: 'QB', team: 'ATL', value: 4200 },
  { firstName: 'Bo', lastName: 'Nix', position: 'QB', team: 'DEN', value: 4000 },
  { firstName: 'Jared', lastName: 'Goff', position: 'QB', team: 'DET', value: 3800 },
  { firstName: 'Dak', lastName: 'Prescott', position: 'QB', team: 'DAL', value: 3600 },
  { firstName: 'Tua', lastName: 'Tagovailoa', position: 'QB', team: 'MIA', value: 3400 },

  // Elite RBs
  { firstName: 'Breece', lastName: 'Hall', position: 'RB', team: 'NYJ', value: 9500 },
  { firstName: 'Bijan', lastName: 'Robinson', position: 'RB', team: 'ATL', value: 9200 },
  { firstName: 'Jahmyr', lastName: 'Gibbs', position: 'RB', team: 'DET', value: 8800 },
  { firstName: 'Jonathan', lastName: 'Taylor', position: 'RB', team: 'IND', value: 8500 },
  { firstName: 'Saquon', lastName: 'Barkley', position: 'RB', team: 'PHI', value: 8200 },
  { firstName: 'Kenneth', lastName: 'Walker', position: 'RB', team: 'SEA', value: 8000 },
  { firstName: 'Kyren', lastName: 'Williams', position: 'RB', team: 'LAR', value: 7800 },
  { firstName: 'De\'Von', lastName: 'Achane', position: 'RB', team: 'MIA', value: 7600 },
  { firstName: 'Derrick', lastName: 'Henry', position: 'RB', team: 'BAL', value: 7400 },
  { firstName: 'Josh', lastName: 'Jacobs', position: 'RB', team: 'GB', value: 7200 },
  { firstName: 'Joe', lastName: 'Mixon', position: 'RB', team: 'HOU', value: 7000 },
  { firstName: 'Travis', lastName: 'Etienne', position: 'RB', team: 'JAX', value: 6800 },
  { firstName: 'Rachaad', lastName: 'White', position: 'RB', team: 'TB', value: 6600 },
  { firstName: 'Isiah', lastName: 'Pacheco', position: 'RB', team: 'KC', value: 6400 },
  { firstName: 'Rhamondre', lastName: 'Stevenson', position: 'RB', team: 'NE', value: 6200 },

  // Elite WRs
  { firstName: 'CeeDee', lastName: 'Lamb', position: 'WR', team: 'DAL', value: 10500 },
  { firstName: 'Ja\'Marr', lastName: 'Chase', position: 'WR', team: 'CIN', value: 10200 },
  { firstName: 'Amon-Ra', lastName: 'St. Brown', position: 'WR', team: 'DET', value: 9800 },
  { firstName: 'Justin', lastName: 'Jefferson', position: 'WR', team: 'MIN', value: 9600 },
  { firstName: 'Jaylen', lastName: 'Waddle', position: 'WR', team: 'MIA', value: 9400 },
  { firstName: 'A.J.', lastName: 'Brown', position: 'WR', team: 'PHI', value: 9200 },
  { firstName: 'DK', lastName: 'Metcalf', position: 'WR', team: 'SEA', value: 9000 },
  { firstName: 'Tyreek', lastName: 'Hill', position: 'WR', team: 'MIA', value: 8800 },
  { firstName: 'Davante', lastName: 'Adams', position: 'WR', team: 'LV', value: 8600 },
  { firstName: 'Cooper', lastName: 'Kupp', position: 'WR', team: 'LAR', value: 8400 },
  { firstName: 'Puka', lastName: 'Nacua', position: 'WR', team: 'LAR', value: 8200 },
  { firstName: 'Garrett', lastName: 'Wilson', position: 'WR', team: 'NYJ', value: 8000 },
  { firstName: 'Chris', lastName: 'Olave', position: 'WR', team: 'NO', value: 7800 },
  { firstName: 'Deebo', lastName: 'Samuel', position: 'WR', team: 'SF', value: 7600 },
  { firstName: 'Mike', lastName: 'Evans', position: 'WR', team: 'TB', value: 7400 },
  { firstName: 'Drake', lastName: 'London', position: 'WR', team: 'ATL', value: 7200 },
  { firstName: 'DeVonta', lastName: 'Smith', position: 'WR', team: 'PHI', value: 7000 },
  { firstName: 'Terry', lastName: 'McLaurin', position: 'WR', team: 'WAS', value: 6800 },

  // Elite TEs
  { firstName: 'Travis', lastName: 'Kelce', position: 'TE', team: 'KC', value: 8500 },
  { firstName: 'Mark', lastName: 'Andrews', position: 'TE', team: 'BAL', value: 8200 },
  { firstName: 'T.J.', lastName: 'Hockenson', position: 'TE', team: 'MIN', value: 8000 },
  { firstName: 'Kyle', lastName: 'Pitts', position: 'TE', team: 'ATL', value: 7800 },
  { firstName: 'George', lastName: 'Kittle', position: 'TE', team: 'SF', value: 7600 },
  { firstName: 'Darren', lastName: 'Waller', position: 'TE', team: 'MIA', value: 7400 },
  { firstName: 'Dallas', lastName: 'Goedert', position: 'TE', team: 'PHI', value: 7200 },
  { firstName: 'Evan', lastName: 'Engram', position: 'TE', team: 'JAX', value: 7000 },
  { firstName: 'Sam', lastName: 'LaPorta', position: 'TE', team: 'DET', value: 6800 },
  { firstName: 'Trey', lastName: 'McBride', position: 'TE', team: 'ARI', value: 6600 },
];

// Helper function to find player value by name matching
export function findPlayerValue(firstName: string, lastName: string, position?: string): number | null {
  const player = dynastyValues.find(p => {
    const firstMatch = p.firstName.toLowerCase() === firstName.toLowerCase();
    const lastMatch = p.lastName.toLowerCase() === lastName.toLowerCase();
    const posMatch = !position || p.position.toLowerCase() === position.toLowerCase();
    return firstMatch && lastMatch && posMatch;
  });
  
  return player ? player.value : null;
}

// Alternative matching for name variations
export function findPlayerValueFlexible(fullName: string, position?: string): number | null {
  const cleanName = fullName.toLowerCase().trim();
  
  const player = dynastyValues.find(p => {
    const playerFullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const posMatch = !position || p.position.toLowerCase() === position.toLowerCase();
    
    // Try exact match first
    if (playerFullName === cleanName && posMatch) return true;
    
    // Try partial matching for names with variations
    const nameParts = cleanName.split(' ');
    const playerParts = playerFullName.split(' ');
    
    if (nameParts.length >= 2 && playerParts.length >= 2) {
      const firstNameMatch = playerParts[0].includes(nameParts[0]) || nameParts[0].includes(playerParts[0]);
      const lastNameMatch = playerParts[playerParts.length - 1].includes(nameParts[nameParts.length - 1]) || 
                           nameParts[nameParts.length - 1].includes(playerParts[playerParts.length - 1]);
      return firstNameMatch && lastNameMatch && posMatch;
    }
    
    return false;
  });
  
  return player ? player.value : null;
}