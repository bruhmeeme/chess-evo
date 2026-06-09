import React, { useMemo } from 'react';
import { Chess } from 'chess.js';

interface CapturedPiecesProps {
  currentFen: string;
  capturedBy: 'w' | 'b'; 
}

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({ currentFen, capturedBy }) => {
  const { capturedIcons, netAdvantage } = useMemo(() => {
    const c = new Chess(currentFen === 'start' ? undefined : currentFen);
    
    const STARTING_PIECES = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    
    const PIECE_SYMBOLS: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
    
    const currentWhite = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    const currentBlack = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    let whiteScore = 0;
    let blackScore = 0;

    for (const row of c.board()) {
        for (const piece of row) {
            if (piece) {
                const val = VALUES[piece.type] || 0;
                if (piece.color === 'w') {
                    // @ts-ignore
                    currentWhite[piece.type]++;
                    whiteScore += val;
                } else {
                    // @ts-ignore
                    currentBlack[piece.type]++;
                    blackScore += val;
                }
            }
        }
    }

    const getCaptured = (start: Record<string, number>, current: Record<string, number>) => {
        let missingList: string[] = [];
        let surplus = 0;
        for (const type of ['q', 'r', 'b', 'n', 'p']) {
            // @ts-ignore
            const diff = start[type] - current[type];
            if (diff < 0) {
                surplus += Math.abs(diff);
            } else if (diff > 0) {
                for (let i = 0; i < diff; i++) {
                   missingList.push(type);
                }
            }
        }
        for (let i = 0; i < surplus; i++) {
            const pIndex = missingList.indexOf('p');
            if (pIndex !== -1) {
                missingList.splice(pIndex, 1);
            }
        }
        missingList.sort((a,b) => VALUES[a] - VALUES[b]);
        return missingList;
    };

    const capturedWhitePieces = getCaptured(STARTING_PIECES, currentWhite); 
    const capturedBlackPieces = getCaptured(STARTING_PIECES, currentBlack);

    const captured = capturedBy === 'w' ? capturedBlackPieces : capturedWhitePieces;
    
    // Captured pieces are rendered with the correct color
    // If capturedBy is 'w', they captured Black pieces, so icons should be black.
    // If capturedBy is 'b', they captured White pieces, so icons should be white.
    // We can use the unicode filled symbols, but color them with Tailwind text colors.
    // Wait, the SVG standard is usually nice, but unicode works well if styled.
    
    const isEnemyWhite = capturedBy === 'b';
    const iconColorClass = isEnemyWhite ? 'text-white' : 'text-[#312e2b] drop-shadow-sm'; 
    // Wait, dark background, so if we use black icons they need a slight outline or white drop-shadow to be visible.
    // Chess.com draws black pieces with white outline on dark mode.
    // Let's use `drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]` for black pieces on dark backgrounds.

    const net = capturedBy === 'w' ? (whiteScore - blackScore) : (blackScore - whiteScore);

    const icons = captured.map((p, i) => (
        <span key={i} className={`text-base leading-none -ml-1 first:ml-0 font-chess ${isEnemyWhite ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-[#21201e] drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)] stroke-white stroke-1'}`}>
            {PIECE_SYMBOLS[p]}
        </span>
    ));

    return { capturedIcons: icons, netAdvantage: net };
  }, [currentFen, capturedBy]);

  if (capturedIcons.length === 0 && netAdvantage <= 0) return null;

  return (
    <div className="flex items-center gap-1 mt-1 h-5">
       <div className="flex items-center">{capturedIcons}</div>
       {netAdvantage > 0 && (
           <span className="text-xs font-semibold text-gray-400 ml-1">+{netAdvantage}</span>
       )}
    </div>
  );
};
