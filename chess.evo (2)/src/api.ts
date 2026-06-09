import { ChessComGame } from './types';

export async function fetchLatestGames(username: string): Promise<ChessComGame[]> {
  try {
    const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
    if (!archivesRes.ok) throw new Error('Failed to fetch user archives');
    const archivesData = await archivesRes.json();
    
    if (!archivesData.archives || archivesData.archives.length === 0) {
      return [];
    }

    // Fetch the latest month archive
    const latestArchiveUrl = archivesData.archives[archivesData.archives.length - 1];
    const gamesRes = await fetch(latestArchiveUrl);
    if (!gamesRes.ok) throw new Error('Failed to fetch games for the latest month');
    
    const gamesData = await gamesRes.json();
    if (!gamesData.games) return [];

    // Return the latest 10 games, assuming the array is chronological, slice from end and reverse
    return gamesData.games.slice().reverse().slice(0, 10);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
