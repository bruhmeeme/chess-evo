import React, { useState, useRef, useEffect } from 'react';
import { Chess, Move } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  Calendar,
  Swords,
  CheckCircle2,
  XCircle,
  MinusCircle,
  GitBranch,
} from 'lucide-react';
import { fetchLatestGames } from './api';
import { ChessComGame } from './types';
import { ChessEngine, EngineEval } from './engine';
import { extractTacticalFacts } from './lib/tactics';
import { EvalBar } from './components/EvalBar';
import { CapturedPieces } from './components/CapturedPieces';

export interface MoveAnalysis {
  moveSan: string;
  evalBefore: EngineEval;
  evalAfter: EngineEval;
  drop: number;
  badge: { name: string, color: string };
  isWhiteTurn: boolean;
}


const getBadge = (drop: number, isBook: boolean, evalBefore: EngineEval, evalAfter: EngineEval, isAbsoluteTopMove: boolean) => {
  if (isBook) return { name: 'Book', color: '#b99c6b' }; // Book color
  if (isAbsoluteTopMove) return { name: 'Best Move', color: '#739552' };
  
  if (evalBefore.mate !== null && evalAfter.mate === null) {
      if (evalBefore.score > 0 && drop > 0) return { name: 'Blunder', color: '#fa412d' };
      if (evalBefore.score < 0 && drop > 0) return { name: 'Blunder', color: '#fa412d' };
  }
  
  if (drop <= 10) return { name: 'Best Move', color: '#739552' };
  if (drop <= 25) return { name: 'Excellent', color: '#96bc4b' };
  if (drop <= 50) return { name: 'Good', color: '#96af8b' };
  if (drop <= 100) return { name: 'Inaccuracy', color: '#fab122' };
  if (drop <= 300) return { name: 'Mistake', color: '#ff7769' };
  return { name: 'Blunder', color: '#fa412d' };
};

export default function App() {
  const [usernameInput, setUsernameInput] = useState('');
  const [activeUser, setActiveUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<ChessComGame | null>(null);
  
  const [sidebarMode, setSidebarMode] = useState<'games' | 'moves'>('games');
  
  const [currentFen, setCurrentFen] = useState('start');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [moves, setMoves] = useState<Move[]>([]);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');

  const [activeBranch, setActiveBranch] = useState<{ startIndex: number, moves: Move[], currentIndex: number } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<MoveAnalysis | null>(null);
  
  const [coachCommentary, setCoachCommentary] = useState<string | null>(null);
  const [isGeneratingCommentary, setIsGeneratingCommentary] = useState(false);
  
  const engineRef = useRef<ChessEngine | null>(null);

  useEffect(() => {
    engineRef.current = new ChessEngine(15);
    return () => {
      if (engineRef.current) engineRef.current.terminate();
    };
  }, []);

  useEffect(() => {
    const analyzeMove = async () => {
      if (!engineRef.current) return;
      
      let isWhiteTurn = true;
      let prevFen = 'start';
      let currentFen = 'start';
      let moveObj: Move | null = null;
      let moveIndexForBook = 0;

      if (activeBranch) {
         if (activeBranch.currentIndex === -1) {
            const curFenC = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            setIsAnalyzing(true);
            setCurrentAnalysis(null);
            const evalAfter = await engineRef.current.evaluateFen(curFenC);
            setCurrentAnalysis({
               moveSan: '',
               evalBefore: evalAfter,
               evalAfter,
               drop: 0,
               badge: { name: '', color: '' },
               isWhiteTurn: true
            });
            setIsAnalyzing(false);
            return; 
         }
         const c = new Chess();
         for (let i = 0; i <= activeBranch.startIndex; i++) c.move(moves[i].san);
         for (let i = 0; i < activeBranch.currentIndex; i++) c.move(activeBranch.moves[i].san);
         prevFen = c.fen();
         moveObj = activeBranch.moves[activeBranch.currentIndex];
         c.move(moveObj.san);
         currentFen = c.fen();
         isWhiteTurn = activeBranch.currentIndex === 0 ? ((activeBranch.startIndex + 1) % 2 === 0) : ((activeBranch.startIndex + 1 + activeBranch.currentIndex) % 2 === 0);
         moveIndexForBook = activeBranch.startIndex + 1 + activeBranch.currentIndex;
      } else {
         if (currentMoveIndex === -1) {
            const curFenC = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            setIsAnalyzing(true);
            setCurrentAnalysis(null);
            const evalAfter = await engineRef.current.evaluateFen(curFenC);
            setCurrentAnalysis({
               moveSan: '',
               evalBefore: evalAfter,
               evalAfter,
               drop: 0,
               badge: { name: '', color: '' },
               isWhiteTurn: true
            });
            setIsAnalyzing(false);
            return; 
         }
         const c = new Chess();
         for (let i = 0; i < currentMoveIndex; i++) c.move(moves[i].san);
         prevFen = c.fen();
         moveObj = moves[currentMoveIndex];
         c.move(moveObj.san);
         currentFen = c.fen();
         isWhiteTurn = currentMoveIndex % 2 === 0;
         moveIndexForBook = currentMoveIndex;
      }

      setIsAnalyzing(true);
      setCurrentAnalysis(null);

      const prevFenC = prevFen === 'start' ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : prevFen;
      const curFenC = currentFen === 'start' ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : currentFen;

      const evalBefore = await engineRef.current.evaluateFen(prevFenC);
      const evalAfter = await engineRef.current.evaluateFen(curFenC);

      const playedUci = `${moveObj.from}${moveObj.to}${moveObj.promotion ? moveObj.promotion : ''}`;
      
      let moveScoreFromBefore = null;
      let isAbsoluteTopMove = false;
      
      if (evalBefore.topMoves && evalBefore.topMoves.length > 0) {
         if (evalBefore.topMoves[0].move === playedUci) {
             isAbsoluteTopMove = true;
         }
         const matchedMove = evalBefore.topMoves.find(m => m.move === playedUci);
         if (matchedMove) {
             moveScoreFromBefore = matchedMove.score;
         }
      }

      const userEvalBefore = isWhiteTurn ? evalBefore.score : -evalBefore.score;
      const userEvalAfterFallback = isWhiteTurn ? evalAfter.score : -evalAfter.score;
      const actualMoveScore = moveScoreFromBefore !== null ? (isWhiteTurn ? moveScoreFromBefore : -moveScoreFromBefore) : userEvalAfterFallback;

      let drop = userEvalBefore - actualMoveScore;

      const isBook = !activeBranch && moveIndexForBook < 8;
      const badge = getBadge(drop, isBook, evalBefore, evalAfter, isAbsoluteTopMove);
      
      const analysisState = {
         moveSan: moveObj.san,
         evalBefore,
         evalAfter,
         drop,
         badge,
         isWhiteTurn
      };
      setCurrentAnalysis(analysisState);
      setIsAnalyzing(false);

      if (selectedGame && activeUser) {
        setCoachCommentary(null);
        // Is it the user's move?
        const isWhitePlayer = selectedGame.white.username.toLowerCase() === activeUser.toLowerCase();
        const isUserMove = isWhitePlayer ? isWhiteTurn : !isWhiteTurn;
        
        if (isUserMove) {
          setIsGeneratingCommentary(true);
          const topMovesMap = evalAfter.topMoves ? evalAfter.topMoves.map(m => m.move).join(', ') : 'none';
          const playerElo = isWhitePlayer ? selectedGame.white.rating : selectedGame.black.rating;
          
          const opponentBestResponseUci = evalAfter.topMoves && evalAfter.topMoves.length > 0 ? evalAfter.topMoves[0].move : undefined;
          const tacticalFacts = extractTacticalFacts(curFenC, drop, opponentBestResponseUci);
          
          const prompt = `Fen: ${curFenC}\nMove Played: ${moveObj.san}\nAccuracy: ${badge.name}\n${tacticalFacts}\nStockfish Top Moves: ${topMovesMap}`;
          
          try {
             const res = await fetch('/api/analyze', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     fen: curFenC,
                     moveNotation: moveObj.san,
                     badgeName: badge.name,
                     topMoves: topMovesMap,
                     playerElo,
                     prompt
                 })
             });
             const json = await res.json();
             if (json.text) {
                 setCoachCommentary(json.text);
             } else if (json.error) {
                 setCoachCommentary(`AI analysis unavailable: ${json.error}`);
             } else {
                 setCoachCommentary("No commentary available.");
             }
          } catch (e) {
             setCoachCommentary("Failed to fetch commentary.");
          }
          setIsGeneratingCommentary(false);
        }
      }
    };

    analyzeMove();
  }, [currentMoveIndex, activeBranch?.currentIndex, selectedGame, activeUser]);

  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!usernameInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fetchedGames = await fetchLatestGames(usernameInput.trim());
      setGames(fetchedGames);
      setActiveUser(usernameInput.trim());
      // reset state
      setSelectedGame(null);
      setSidebarMode('games');
      setCurrentFen('start');
      setCurrentMoveIndex(-1);
      setMoves([]);
      setActiveBranch(null);
    } catch (err) {
      setError('Failed to fetch games or no games found.');
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGameSelect = (game: ChessComGame) => {
    try {
      const c = new Chess();
      c.loadPgn(game.pgn);
      const history = c.history({ verbose: true }) as Move[];
      setMoves(history);

      c.reset();
      setCurrentFen(c.fen());
      setCurrentMoveIndex(-1);
      setActiveBranch(null);
      
      const isWhite = game.white.username.toLowerCase() === activeUser.toLowerCase();
      setOrientation(isWhite ? 'white' : 'black');
      
      setSelectedGame(game);
      setSidebarMode('moves');
    } catch (e) {
      console.error('Error parsing game PGN', e);
    }
  };

  const returnToMainLine = () => {
    if (activeBranch) {
      const c = new Chess();
      for (let i = 0; i <= activeBranch.startIndex; i++) {
        c.move(moves[i].san);
      }
      setCurrentFen(c.fen());
      setCurrentMoveIndex(activeBranch.startIndex);
      setActiveBranch(null);
    }
  };

  const goToMove = (index: number) => {
    if (!selectedGame || index < -1 || index >= moves.length) return;
    const c = new Chess();
    for (let i = 0; i <= index; i++) {
      c.move(moves[i].san);
    }
    setCurrentFen(c.fen());
    setCurrentMoveIndex(index);
    if (activeBranch) {
      setActiveBranch(null);
    }
  };

  const goToBranchMove = (bIndex: number) => {
    if (!activeBranch) return;
    const c = new Chess();
    for (let i = 0; i <= activeBranch.startIndex; i++) {
      c.move(moves[i].san);
    }
    for (let i = 0; i <= bIndex; i++) {
      c.move(activeBranch.moves[i].san);
    }
    setCurrentFen(c.fen());
    setActiveBranch({ ...activeBranch, currentIndex: bIndex });
  };

  const handleNav = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (activeBranch) {
      if (direction === 'first') returnToMainLine();
      else if (direction === 'prev') {
        if (activeBranch.currentIndex > -1) goToBranchMove(activeBranch.currentIndex - 1);
        else returnToMainLine(); // went back beyond the branch root
      }
      else if (direction === 'next') goToBranchMove(Math.min(activeBranch.currentIndex + 1, activeBranch.moves.length - 1));
      else if (direction === 'last') goToBranchMove(activeBranch.moves.length - 1);
    } else {
      if (direction === 'first') goToMove(-1);
      else if (direction === 'prev') goToMove(currentMoveIndex - 1);
      else if (direction === 'next') goToMove(currentMoveIndex + 1);
      else if (direction === 'last') goToMove(moves.length - 1);
    }
  };

  const onPieceDrop = ({ sourceSquare, targetSquare, piece }: { sourceSquare: string, targetSquare: string | null, piece: { pieceType: string } }) => {
    if (!targetSquare) return false;
    const c = new Chess(currentFen);
    try {
      const move = c.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: ['p', 'P'].includes(piece.pieceType) ? 'q' : undefined,
      });
      if (move) {
        if (!activeBranch) {
          const nextMainMove = currentMoveIndex + 1 < moves.length ? moves[currentMoveIndex + 1] : null;
          if (nextMainMove && move.san === nextMainMove.san) {
            setCurrentFen(c.fen());
            setCurrentMoveIndex(currentMoveIndex + 1);
          } else {
            setActiveBranch({
              startIndex: currentMoveIndex,
              moves: [move],
              currentIndex: 0
            });
            setCurrentFen(c.fen());
          }
        } else {
          const newMoves = activeBranch.moves.slice(0, activeBranch.currentIndex + 1);
          newMoves.push(move);
          setActiveBranch({
            ...activeBranch,
            moves: newMoves,
            currentIndex: newMoves.length - 1
          });
          setCurrentFen(c.fen());
        }
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  const formatResult = (game: ChessComGame) => {
    const isWhite = game.white.username.toLowerCase() === activeUser.toLowerCase();
    const myResult = isWhite ? game.white.result : game.black.result;
    
    if (['win'].includes(myResult)) return <span className="text-[#739552] font-medium flex-1 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Won</span>;
    if (['checkmated', 'timeout', 'resigned', 'lose'].includes(myResult)) return <span className="text-red-500 font-medium flex-1 flex items-center gap-1"><XCircle className="w-4 h-4"/> Lost</span>;
    return <span className="text-gray-400 font-medium flex-1 flex items-center gap-1"><MinusCircle className="w-4 h-4"/> Draw</span>;
  };

  const renderBranchMoves = () => {
    if (!activeBranch) return null;
    const firstMoveIsWhite = (activeBranch.startIndex + 1) % 2 === 0;
    const pairs: Array<{ w: { move: Move, index: number } | null, b: { move: Move, index: number } | null }> = [];
    
    activeBranch.moves.forEach((move, i) => {
      if (firstMoveIsWhite) {
        if (i % 2 === 0) pairs.push({ w: { move, index: i }, b: null });
        else pairs[pairs.length - 1].b = { move, index: i };
      } else {
        if (i === 0) pairs.push({ w: null, b: { move, index: i } });
        else if (i % 2 === 1) pairs.push({ w: { move, index: i }, b: null });
        else pairs[pairs.length - 1].b = { move, index: i };
      }
    });

    return (
      <div className="grid grid-cols-[24px_1fr_1fr] gap-x-2 gap-y-1 text-xs mt-2">
        {pairs.map((p, rIdx) => {
           const baseIndex = p.w ? p.w.index : p.b!.index;
           const realMoveNumber = Math.floor((activeBranch.startIndex + 1 + baseIndex) / 2) + 1;
           return (
             <React.Fragment key={rIdx}>
               <span className="text-gray-500 text-[10px] self-center shrink-0">{realMoveNumber}.</span>
               {p.w ? (
                 <button onClick={() => goToBranchMove(p.w!.index)} className={`px-2 py-1 flex-1 flex justify-between items-center text-left rounded truncate transition-colors ${activeBranch.currentIndex === p.w.index ? 'bg-[#739552] text-white font-semibold' : 'hover:bg-[#312e2b] text-[#bababa]'}`}>
                   <span>{p.w.move.san}</span>
                 </button>
               ) : <span></span>}
               {p.b ? (
                 <button onClick={() => goToBranchMove(p.b!.index)} className={`px-2 py-1 flex-1 flex justify-between items-center text-left rounded truncate transition-colors ${activeBranch.currentIndex === p.b.index ? 'bg-[#739552] text-white font-semibold' : 'hover:bg-[#312e2b] text-[#bababa]'}`}>
                   <span>{p.b.move.san}</span>
                 </button>
               ) : <span></span>}
             </React.Fragment>
           );
        })}
      </div>
    );
  };

  const lastMoveObj = activeBranch ? 
    (activeBranch.currentIndex >= 0 ? activeBranch.moves[activeBranch.currentIndex] : (activeBranch.startIndex >= 0 ? moves[activeBranch.startIndex] : null)) 
    : (currentMoveIndex >= 0 ? moves[currentMoveIndex] : null);

  let lastMoveNumber = 0;
  let lastMoveIsWhiteTurn = true;
  if (activeBranch) {
    if (activeBranch.currentIndex >= 0) {
      lastMoveNumber = Math.floor((activeBranch.startIndex + 1 + activeBranch.currentIndex) / 2) + 1;
      lastMoveIsWhiteTurn = (activeBranch.startIndex + 1 + activeBranch.currentIndex) % 2 === 0;
    } else if (activeBranch.startIndex >= 0) {
      lastMoveNumber = Math.floor(activeBranch.startIndex / 2) + 1;
      lastMoveIsWhiteTurn = activeBranch.startIndex % 2 === 0;
    }
  } else {
    if (currentMoveIndex >= 0) {
       lastMoveNumber = Math.floor(currentMoveIndex / 2) + 1;
       lastMoveIsWhiteTurn = currentMoveIndex % 2 === 0;
    }
  }

  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (lastMoveObj) {
    customSquareStyles[lastMoveObj.from] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' };
    customSquareStyles[lastMoveObj.to] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' };
  }

  let engineArrows: any[] = [];
  if (currentAnalysis && currentAnalysis.evalAfter && currentAnalysis.evalAfter.topMoves) {
    const opacities = ['0.9', '0.6', '0.3'];
    engineArrows = currentAnalysis.evalAfter.topMoves.slice(0, 3).map((m, idx) => {
      if (!m.move) return null;
      return {
        startSquare: m.move.substring(0, 2),
        endSquare: m.move.substring(2, 4),
        color: `rgba(255, 153, 0, ${opacities[idx]})`
      };
    }).filter(a => a !== null);
  }

  return (
    <div className="flex flex-col h-screen bg-[#161512] text-[#bababa] font-sans overflow-hidden text-sm">
      {/* Top Bar */}
      <header className="h-14 bg-[#21201d] border-b border-[#312e2b] flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-white mr-8">
          <span className="text-[#739552]">♟</span> CHESS.EVO
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              placeholder="Chess.com Username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              className="pl-9 pr-4 py-2 bg-[#161512] border border-[#312e2b] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#739552] transition-all w-64 text-white"
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="px-4 py-2 bg-[#739552] hover:bg-[#86aa60] disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
          >
            {loading ? 'FETCHING...' : 'FETCH GAMES'}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className="w-72 bg-[#262421] border-r border-[#312e2b] flex flex-col shrink-0">
          {sidebarMode === 'games' ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-[#312e2b] flex justify-between items-center shrink-0">
                <h2 className="font-semibold text-white uppercase tracking-widest text-[10px] opacity-70">Recent Games</h2>
                <span className="text-[10px] bg-[#312e2b] px-2 py-0.5 rounded text-white">{games.length} Matches</span>
              </div>
              {error && <p className="text-sm text-red-500 p-4">{error}</p>}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {games.map((game, i) => {
                  const isWhite = game.white.username.toLowerCase() === activeUser.toLowerCase();
                  const opponent = isWhite ? game.black.username : game.white.username;
                  const date = new Date(game.end_time * 1000).toLocaleDateString();
                  const isSelected = selectedGame?.uuid === game.uuid;

                  return (
                    <button
                      key={game.uuid || i}
                      onClick={() => handleGameSelect(game)}
                      className={`w-full text-left p-4 cursor-pointer flex flex-col gap-1 border-b border-[#312e2b] hover:bg-[#312e2b] transition-all ${isSelected ? 'bg-[#312e2b] border-l-4 border-l-[#739552]' : 'border-l-4 border-l-transparent'}`}
                    >
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-white truncate mr-2">vs {opponent}</span>
                        <span className="text-xs font-bold px-2 py-0.5">
                          {formatResult(game)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>{isWhite ? 'White' : 'Black'} • {game.time_class}</span>
                        <span className="opacity-50">{date}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-[#312e2b] shrink-0 bg-[#262421] z-10 sticky top-0 flex flex-col gap-3">
                <button
                  onClick={() => setSidebarMode('games')}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-gray-500 hover:text-white transition-colors w-fit"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Games
                </button>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white uppercase tracking-widest text-[10px] opacity-70">Move List</h2>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold uppercase tracking-widest">
                    {isAnalyzing ? <span className="w-2 h-2 rounded-full bg-[#fa412d] animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-[#739552]" />}
                    {isAnalyzing ? 'Analyzing...' : 'Stockfish 17'}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                <div className="grid grid-cols-2 font-mono text-sm">
                  {/* Headers */}
                  <div className="text-gray-500 border-b border-[#312e2b] px-4 py-2 sticky top-0 bg-[#262421]">White</div>
                  <div className="text-gray-500 border-b border-[#312e2b] px-4 py-2 sticky top-0 bg-[#262421]">Black</div>
                  
                  {activeBranch && activeBranch.startIndex === -1 && (
                    <div className="col-span-2 bg-[#21201d] border-l-4 border-l-[#739552] p-3 mx-2 my-2 rounded shadow-inner">
                      <div className="flex justify-between items-center mb-2 border-b border-[#312e2b] pb-2">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1"><GitBranch className="w-3 h-3" /> Custom Variation</span>
                        <button onClick={returnToMainLine} className="text-[10px] bg-[#312e2b] hover:bg-[#3c3934] text-white px-2 py-1 rounded transition-colors uppercase tracking-widest font-bold border border-[#403d39] flex items-center gap-1"><XCircle className="w-3 h-3" />Discard</button>
                      </div>
                      {renderBranchMoves()}
                    </div>
                  )}

                  {/* Moves */}
                  {moves.reduce((pairs, move, index) => {
                    // If we are in a branch, we might still want to render the rest of the main line moves.
                    // But we will grey them out.
                    if (index % 2 === 0) pairs.push([move, null]);
                    else pairs[pairs.length - 1][1] = move;
                    return pairs;
                  }, [] as [Move, Move | null][]).map((pair, rowIndex) => {
                    const whiteMoveIndex = rowIndex * 2;
                    const blackMoveIndex = rowIndex * 2 + 1;
                    const isAfterBranchStart = activeBranch && whiteMoveIndex > activeBranch.startIndex;
                    const isBlackAfterBranchStart = activeBranch && blackMoveIndex > activeBranch.startIndex;
                    
                    return (
                      <React.Fragment key={rowIndex}>
                        <div className={`flex items-baseline px-4 py-1 border-b border-[#312e2b]/50 ${isAfterBranchStart ? 'opacity-30' : ''}`}>
                          <span className="text-gray-600 w-6 shrink-0 text-[10px]">{rowIndex + 1}.</span>
                          <button
                            onClick={() => goToMove(whiteMoveIndex)}
                            className={`px-1 flex-1 flex justify-between items-center text-left rounded hover:bg-[#312e2b] transition-colors ${currentMoveIndex === whiteMoveIndex && !activeBranch ? 'bg-[#739552] text-white font-semibold' : 'text-[#bababa]'}`}
                          >
                            <span>{pair[0].san}</span>
                          </button>
                        </div>
                        <div className={`flex items-baseline px-4 py-1 border-b border-[#312e2b]/50 ${isBlackAfterBranchStart ? 'opacity-30' : ''}`}>
                          {pair[1] ? (
                            <button
                              onClick={() => goToMove(blackMoveIndex)}
                              className={`px-1 flex-1 flex justify-between items-center text-left rounded hover:bg-[#312e2b] transition-colors ${currentMoveIndex === blackMoveIndex && !activeBranch ? 'bg-[#739552] text-white font-semibold' : 'text-[#bababa]'}`}
                            >
                              <span>{pair[1].san}</span>
                            </button>
                          ) : (
                            <span className="px-1 flex-1" />
                          )}
                        </div>
                        {activeBranch && Math.floor(activeBranch.startIndex / 2) === rowIndex && (
                          <div className="col-span-2 bg-[#21201d] border-l-4 border-l-[#739552] p-3 mx-2 my-2 rounded shadow-inner">
                            <div className="flex justify-between items-center mb-2 border-b border-[#312e2b] pb-2">
                              <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1"><GitBranch className="w-3 h-3" /> Custom Variation</span>
                              <button onClick={returnToMainLine} className="text-[10px] bg-[#312e2b] hover:bg-[#3c3934] text-white px-2 py-1 rounded transition-colors uppercase tracking-widest font-bold border border-[#403d39] flex items-center gap-1"><XCircle className="w-3 h-3" />Discard</button>
                            </div>
                            {renderBranchMoves()}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Center Board Column */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[#161512]">
          <div className="flex flex-col items-center">
            {selectedGame ? (
              <div className="flex gap-4 items-center">
                 {/* Eval Bar Column */}
                 <div className="h-[480px] w-6 shrink-0 z-10 box-content pt-4 pb-4">
                    <EvalBar evaluation={currentAnalysis?.evalAfter || null} orientation={orientation} />
                 </div>
                 
                 <div className="flex flex-col">
                   {/* Board header */}
                   <div className="w-[480px] flex justify-between items-start mb-2">
                     <div className="flex items-start gap-3">
                       <div className="w-10 h-10 bg-[#312e2b] rounded-sm flex items-center justify-center text-xl text-white select-none whitespace-pre drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                         {orientation === 'white' ? '♟\uFE0E' : '♙\uFE0E'}
                       </div>
                       <div>
                         <div className="flex items-center gap-2">
                           <p className="text-white font-semibold leading-none">{orientation === 'white' ? selectedGame.black.username : selectedGame.white.username}</p>
                           <p className="text-[10px] text-gray-500 font-mono">({orientation === 'white' ? selectedGame.black.rating : selectedGame.white.rating})</p>
                         </div>
                         <CapturedPieces currentFen={currentFen} capturedBy={orientation === 'white' ? 'b' : 'w'} />
                       </div>
                     </div>
                     <div className="bg-[#312e2b] px-3 py-1 rounded text-xs font-mono text-white mt-1">Opponent</div>
                   </div>

                <div className="w-[480px] aspect-square relative box-content border-4 border-[#312e2b] shadow-2xl">
                  <Chessboard 
                    options={{
                      position: currentFen,
                      boardOrientation: orientation,
                      allowDragging: true,
                      onPieceDrop: onPieceDrop,
                      darkSquareStyle: { backgroundColor: '#739552' },
                      lightSquareStyle: { backgroundColor: '#ebecd0' },
                      squareStyles: customSquareStyles,
                      arrows: engineArrows
                    }}
                  />
                </div>

                {/* Board footer */}
                <div className="flex justify-between w-[480px] mt-2 items-end">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#312e2b] rounded-sm flex items-center justify-center text-xl text-[#21201e] select-none whitespace-pre drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]">
                      {orientation === 'white' ? '♙\uFE0E' : '♟\uFE0E'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold leading-none">{orientation === 'white' ? selectedGame.white.username : selectedGame.black.username}</p>
                        <p className="text-[10px] text-gray-500 font-mono">({orientation === 'white' ? selectedGame.white.rating : selectedGame.black.rating})</p>
                      </div>
                      <CapturedPieces currentFen={currentFen} capturedBy={orientation === 'white' ? 'w' : 'b'} />
                    </div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <button 
                      onClick={() => handleNav('first')}
                      className="w-10 h-10 rounded flex items-center justify-center bg-[#312e2b] hover:bg-[#3c3934] hover:text-white transition-all"
                    >
                      <ChevronsLeft className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleNav('prev')}
                      className="w-10 h-10 rounded flex items-center justify-center bg-[#312e2b] hover:bg-[#3c3934] hover:text-white transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleNav('next')}
                      className="w-10 h-10 rounded flex items-center justify-center bg-[#739552] text-white hover:bg-[#86aa60] transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleNav('last')}
                      className="w-10 h-10 rounded flex items-center justify-center bg-[#312e2b] hover:bg-[#3c3934] hover:text-white transition-all"
                    >
                      <ChevronsRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-gray-500 h-full p-12">
                <Swords className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-xl font-medium text-gray-400 mb-2">No Game Selected</h3>
                <p className="max-w-md">
                  Enter a Chess.com username and fetch their recent monthly games, then select a game from the sidebar to start reviewing.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Coach Review */}
        <aside className="w-72 coach-panel border-l border-[#312e2b] flex flex-col shrink-0">
          <div className="p-6 border-b border-[#312e2b]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#739552] animate-pulse"></div>
              <h3 className="text-white font-semibold text-xs uppercase tracking-widest">Coach Review</h3>
            </div>
            
            {!selectedGame ? (
              <div className="bg-[#161512] rounded p-4 border border-[#312e2b]">
                <p className="text-xs text-gray-500 italic leading-relaxed">
                  Select a game to see the coach review panel.
                </p>
              </div>
            ) : (
              <div className="bg-[#161512] rounded p-4 border border-[#312e2b]">
                {lastMoveObj === null ? (
                  <p className="text-xs text-gray-300 italic leading-relaxed">
                    "Ready to analyze your moves."
                  </p>
                ) : (() => {
                  const isWhitePlayer = selectedGame.white.username.toLowerCase() === activeUser.toLowerCase();
                  const isUserMove = isWhitePlayer ? lastMoveIsWhiteTurn : !lastMoveIsWhiteTurn;
                  if (!isUserMove) {
                    return (
                      <p className="text-xs text-gray-500 italic leading-relaxed">
                        Opponent's move. AI commentary skipped to save tokens.
                      </p>
                    );
                  }
                  if (isGeneratingCommentary) {
                    return (
                      <div className="flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-[#739552] animate-pulse"></span>
                         <p className="text-xs text-[#739552] italic">Grandmaster is analyzing...</p>
                      </div>
                    );
                  }
                  if (coachCommentary) {
                    return (
                      <p className="text-lg font-medium leading-relaxed text-gray-200">
                        "{coachCommentary}"
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-gray-300 italic leading-relaxed">
                      "Make a move to see commentary."
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            {selectedGame && (
              <>
                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4 font-bold">Move Analysis</h4>
                {lastMoveObj ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] bg-[#312e2b] px-1.5 py-0.5 rounded text-white font-mono">
                        {lastMoveNumber}.{lastMoveIsWhiteTurn ? '' : '..'}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-base font-semibold">{lastMoveObj.san}</p>
                          {currentAnalysis && currentAnalysis.moveSan === lastMoveObj.san && !isAnalyzing && (
                            <span style={{ backgroundColor: currentAnalysis.badge.color }} className="text-[10px] px-2 py-0.5 rounded text-white font-bold leading-tight uppercase tracking-widest">{currentAnalysis.badge.name}</span>
                          )}
                        </div>
                        {isAnalyzing ? (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#739552] animate-pulse"></span>
                            <p className="text-[10px] text-[#739552] uppercase tracking-widest font-bold">Engine evaluating...</p>
                          </div>
                        ) : currentAnalysis && currentAnalysis.moveSan === lastMoveObj.san ? (
                          <div className="mt-4 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-[#21201d] rounded p-2 border border-[#312e2b]">
                                <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Eval Drop</div>
                                <div className="text-xs font-mono font-bold text-[#bababa]">{currentAnalysis.drop > 0 ? '-' : '+'}{Math.abs(currentAnalysis.drop / 100).toFixed(2)}</div>
                              </div>
                              <div className="bg-[#21201d] rounded p-2 border border-[#312e2b]">
                                <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Best Engine Move</div>
                                <div className="text-xs font-mono font-bold text-white">{currentAnalysis.evalBefore.bestMove || 'N/A'}</div>
                              </div>
                            </div>
                            <div className="bg-[#21201d] rounded p-3 border border-[#312e2b]">
                                <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Stockfish 17 Eval</div>
                                <div className="text-xs font-mono font-bold text-[#739552]">
                                    {currentAnalysis.evalAfter.mate !== null 
                                      ? `MATE IN ${Math.abs(currentAnalysis.evalAfter.mate)}` 
                                      : `${currentAnalysis.evalAfter.score > 0 ? '+' : ''}${(currentAnalysis.evalAfter.score / 100).toFixed(2)}`}
                                </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500">Starting position</p>
                )}
              </>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}

