// @ts-ignore
import StockfishWorker from 'stockfish.js/stockfish.js?worker';

export interface EngineMove {
  move: string;
  score: number; // in centipawns
  mate: number | null;
}

export interface EngineEval {
  score: number; // in centipawns from White's perspective
  mate: number | null; // mate in X from White's perspective
  bestMove: string;
  topMoves: EngineMove[];
}

export class ChessEngine {
  private worker: Worker;
  private currentCallback: ((ev: EngineEval) => void) | null = null;
  private currentScore: number = 0;
  private currentMate: number | null = null;
  private currentBestMove: string = '';
  private currentTopMoves: EngineMove[] = [];
  private engineSideToMove: 'w' | 'b' = 'w';
  private depth: number;

  constructor(depth: number = 15) {
    this.worker = new StockfishWorker();
    this.depth = depth;
    
    this.worker.onmessage = (e) => {
      const line = e.data;
      if (typeof line !== 'string') return;
      
      const depthMatch = line.match(/depth (\d+)/);
      const isFinal = depthMatch && parseInt(depthMatch[1]) >= this.depth;
      
      let multiPvIndex = 1;
      const multiPvMatch = line.match(/multipv (\d+)/);
      if (multiPvMatch) {
         multiPvIndex = parseInt(multiPvMatch[1]);
      }

      let score = 0;
      let mate: number | null = null;
      let pvMove = '';

      const scoreMatch = line.match(/score cp (-?\d+)/);
      if (scoreMatch) {
         let cp = parseInt(scoreMatch[1]);
         score = this.engineSideToMove === 'w' ? cp : -cp;
      }
      
      const mateMatch = line.match(/score mate (-?\d+)/);
      if (mateMatch) {
         let m = parseInt(mateMatch[1]);
         mate = this.engineSideToMove === 'w' ? m : -m;
         score = mate > 0 ? 10000 : -10000;
      }
      
      const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
      if (pvMatch) {
         pvMove = pvMatch[1];
      }

      if (multiPvIndex >= 1 && multiPvIndex <= 3 && pvMove) {
         this.currentTopMoves[multiPvIndex - 1] = {
            move: pvMove,
            score: score,
            mate: mate
         };
         if (multiPvIndex === 1) {
            this.currentScore = score;
            this.currentMate = mate;
            this.currentBestMove = pvMove;
         }
      }

      if (line.includes('bestmove')) {
        const bmMatch = line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (bmMatch) {
            this.currentBestMove = bmMatch[1];
        }
        if (this.currentCallback) {
            // ensure currentTopMoves has valid entries
            const topMoves = this.currentTopMoves.filter(m => !!m);
            this.currentCallback({
                score: this.currentScore,
                mate: this.currentMate,
                bestMove: this.currentBestMove,
                topMoves: topMoves
            });
            this.currentCallback = null;
        }
      }
    };
  }

  public async evaluateFen(fen: string): Promise<EngineEval> {
    return new Promise((resolve) => {
      this.currentCallback = resolve;
      this.currentTopMoves = [];
      this.engineSideToMove = fen.split(' ')[1] === 'w' ? 'w' : 'b';
      this.worker.postMessage('uci');
      this.worker.postMessage('isready');
      this.worker.postMessage('setoption name MultiPV value 3');
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${this.depth}`);
    });
  }

  public terminate() {
    this.worker.terminate();
  }
}
