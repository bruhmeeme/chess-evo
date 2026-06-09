import { Chess, Square } from 'chess.js';

export function extractTacticalFacts(
  fenAfterUserMove: string,
  drop: number,
  bestOpponentResponseUci?: string
): string {
  const dropText = `Evaluation dropped by ${Math.abs(drop / 100).toFixed(2)} points.`;
  
  if (!bestOpponentResponseUci || bestOpponentResponseUci === 'none') {
    return `${dropText} No clear opponent response available.`;
  }

  const c = new Chess(fenAfterUserMove);
  const tactics: string[] = [];

  try {
    const from = bestOpponentResponseUci.substring(0, 2) as Square;
    const to = bestOpponentResponseUci.substring(2, 4) as Square;
    const promo = bestOpponentResponseUci.length > 4 ? bestOpponentResponseUci.substring(4, 5) : undefined;

    const move = c.move({ from, to, promotion: promo });
    
    if (move.captured) {
        tactics.push(`The opponent's best response (${move.san}) directly captures a ${move.captured} on ${to} (Hanging piece or forced trade).`);
    }

    if (c.isCheck()) {
       tactics.push(`The opponent's response attacks the King (Check).`);
    }

    // Check for Fork by switching turn back to opponent to see what the moved piece threatens next
    const fenTokens = c.fen().split(' ');
    fenTokens[1] = fenTokens[1] === 'w' ? 'b' : 'w'; // Switch turn back to opponent
    fenTokens[3] = '-'; // Clear en passant square to avoid invalid FENs when modifying turn
    
    const swappedFen = fenTokens.join(' ');
    const cOpp = new Chess(swappedFen);
    
    const oppMoves = cOpp.moves({ verbose: true });
    
    // Find all capture moves originating from the square 'to'
    const attacksFromTo = oppMoves.filter(m => m.from === to && m.captured);
    
    // To be a form of fork/multi-attack, it must attack multiple distinct pieces.
    const uniqueAttacks = new Set(attacksFromTo.map(m => m.to));
    
    if (uniqueAttacks.size >= 2) {
        const attackedPieces = Array.from(uniqueAttacks).map(sq => {
            const piece = cOpp.get(sq as Square);
            return piece ? piece.type : 'piece';
        });
        tactics.push(`The response creates a Fork, simultaneously attacking multiple targets (${attackedPieces.join(' and ')}).`);
    }

  } catch (e) {
    console.warn("Tactics extraction warning:", e);
  }

  const tacticsText = tactics.length > 0 ? tactics.join(" ") : "No immediate hanging pieces or basic forks detected.";
  return `Concrete Tactical Facts: ${dropText} ${tacticsText}`;
}
