import React from 'react';
import { EngineEval } from '../engine';

interface EvalBarProps {
  evaluation: EngineEval | null;
  orientation?: 'white' | 'black';
}

export const EvalBar: React.FC<EvalBarProps> = ({ evaluation, orientation = 'white' }) => {
  const defaultScore = 0;
  const score = evaluation?.score ?? defaultScore;
  const mate = evaluation?.mate ?? null;

  const scorePawns = score / 100;
  
  let whitePercent = 50 + 50 * (2 / (1 + Math.exp(-0.3 * scorePawns)) - 1);
  
  let label = scorePawns > 0 ? `+${scorePawns.toFixed(1)}` : scorePawns.toFixed(1);
  if (scorePawns === 0) label = "0.0";
  
  let isMate = false;
  let mateBgPulse = false;
  if (mate !== null) {
      isMate = true;
      if (mate > 0) {
          whitePercent = 98;
          label = `M${mate}`;
      } else {
          whitePercent = 2;
          label = `-M${Math.abs(mate)}`;
      }
      mateBgPulse = true;
  }

  const isWhiteBottom = orientation === 'white';
  const bottomPercent = isWhiteBottom ? whitePercent : (100 - whitePercent);
  const bottomColor = isWhiteBottom ? '#ffffff' : '#21201e';
  const topColor = isWhiteBottom ? '#21201e' : '#ffffff';

  const textTop = bottomPercent < 50;
  const textColorClass = textTop 
      ? (isWhiteBottom ? 'text-white' : 'text-[#21201e]')
      : (isWhiteBottom ? 'text-[#21201e]' : 'text-white');

  return (
    <div className="w-6 h-full relative rounded overflow-hidden flex flex-col" style={{ backgroundColor: topColor }}>
      <div 
         className={`w-full absolute bottom-0 ${mateBgPulse ? 'animate-pulse' : ''}`}
         style={{ height: `${bottomPercent}%`, backgroundColor: bottomColor, transition: 'height 0.3s ease-in-out' }}
      ></div>
      <div className={`absolute left-0 right-0 text-center text-[10px] font-bold z-10 ${textTop ? 'top-2' : 'bottom-2'} ${textColorClass}`}>
        {label}
      </div>
    </div>
  );
};
