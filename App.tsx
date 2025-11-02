
import React, { useState, useRef, useEffect, useCallback } from 'react';

// --- TYPE DEFINITIONS ---
interface Point {
  x: number;
  y: number;
}

interface AnalysisResult {
  score: number;
  center: Point;
  radius: number;
}

type AppState = 'IDLE' | 'DRAWING' | 'ANALYZING' | 'RESULT';

// --- HELPER ICONS ---
const RedoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8C6.8 8 3.2 11.2 2.24 15.53L4.25 16.03C5.03 12.63 7.97 10 11.5 10C13.46 10 15.22 10.79 16.56 12.06L14 14.62H22V6.62L18.4 10.6Z" />
  </svg>
);

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
);

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const getCoords = useCallback((event: React.MouseEvent | React.TouchEvent): Point | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in event.nativeEvent) {
      clientX = event.nativeEvent.touches[0].clientX;
      clientY = event.nativeEvent.touches[0].clientY;
    } else {
      clientX = (event as React.MouseEvent).clientX;
      clientY = (event as React.MouseEvent).clientY;
    }
    
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const analyzeCircle = (path: Point[]): AnalysisResult | null => {
    if (path.length < 10) return null;

    // 1. Calculate the centroid (geometric center)
    const centroid = path.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const centerX = centroid.x / path.length;
    const centerY = centroid.y / path.length;
    const center = { x: centerX, y: centerY };

    // 2. Calculate the distance of each point from the center (radii)
    const radii = path.map(p => Math.hypot(p.x - centerX, p.y - centerY));
    
    // 3. Calculate the average radius
    const meanRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
    if (meanRadius === 0) return null;

    // 4. Calculate the standard deviation of the radii
    const variance = radii.reduce((sum, r) => sum + Math.pow(r - meanRadius, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);
    
    // 5. Calculate score based on deviation (lower deviation is better)
    const normalizedDeviation = stdDev / meanRadius;
    let scoreFromShape = Math.max(0, (1 - normalizedDeviation * 3) * 100); // K=3 is a tuning factor

    // 6. Penalize for not being a closed loop
    const startPoint = path[0];
    const endPoint = path[path.length - 1];
    const closingDistance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    const closingPenalty = Math.min(1, closingDistance / meanRadius) * 25; // Max 25 points penalty
    
    const finalScore = Math.max(0, scoreFromShape - closingPenalty);

    return {
      score: finalScore,
      center,
      radius: meanRadius,
    };
  };

  const handleStartDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    setAppState('DRAWING');
    setResult(null);
    const coords = getCoords(event);
    if (coords) {
      setPoints([coords]);
    }
  }, [getCoords]);

  const handleDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (appState !== 'DRAWING') return;
    event.preventDefault();
    const coords = getCoords(event);
    if (coords) {
      setPoints(prevPoints => [...prevPoints, coords]);
    }
  }, [appState, getCoords]);

  const handleEndDrawing = useCallback(() => {
    if (appState !== 'DRAWING' || points.length < 10) {
      setAppState('IDLE');
      setPoints([]);
      setResult(null);
      return;
    }
    setAppState('ANALYZING');
    
    setTimeout(() => { // Simulate analysis time for UX
        const analysis = analyzeCircle(points);
        setResult(analysis);
        setAppState('RESULT');
    }, 500);

  }, [appState, points]);
  
  const handleReset = useCallback(() => {
    setAppState('IDLE');
    setPoints([]);
    setResult(null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#1f2937'; // bg-gray-800
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw user path
    if (points.length > 1) {
      ctx.strokeStyle = '#22d3ee'; // cyan-400
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
    
    // Draw analysis result if available
    if (result) {
      // Draw the perfect circle
      ctx.strokeStyle = '#4ade80'; // green-400
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(result.center.x, result.center.y, result.radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw the center point
      ctx.fillStyle = '#f87171'; // red-400
      ctx.beginPath();
      ctx.arc(result.center.x, result.center.y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [points, result, appState]);

  const renderStatusMessage = () => {
    const messageContainerClasses = "flex items-center justify-center text-center h-24 transition-opacity duration-300";

    switch (appState) {
        case 'IDLE':
            return <div className={messageContainerClasses}><h2 className="text-2xl font-semibold text-gray-300">Draw a perfect circle</h2></div>;
        case 'ANALYZING':
            return <div className={messageContainerClasses}><LoadingSpinner /></div>;
        case 'RESULT':
            return (
                <div className={`${messageContainerClasses} opacity-100`}>
                    {result ? (
                        <div>
                            <p className="text-xl text-gray-400">Perfection Score</p>
                            <p className="text-6xl font-bold" style={{color: `hsl(${result.score}, 80%, 60%)`}}>
                                {Math.round(result.score)}%
                            </p>
                        </div>
                    ) : <div className="h-24">&nbsp;</div>}
                </div>
            );
        case 'DRAWING':
        default:
            return <div className="h-24">&nbsp;</div>; // Placeholder to prevent layout shift
    }
  };

  return (
    <main className="bg-gray-900 text-white w-screen h-screen flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
        <div className="w-full max-w-lg mx-auto flex flex-col items-center">
            {renderStatusMessage()}
            <div 
              className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl bg-gray-800 touch-none border-2 border-gray-700"
            >
                <canvas
                    ref={canvasRef}
                    onMouseDown={handleStartDrawing}
                    onMouseMove={handleDrawing}
                    onMouseUp={handleEndDrawing}
                    onMouseLeave={handleEndDrawing}
                    onTouchStart={handleStartDrawing}
                    onTouchMove={handleDrawing}
                    onTouchEnd={handleEndDrawing}
                    className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                />
            </div>

            <div className="h-24 flex items-center justify-center mt-4">
              {appState === 'RESULT' && (
                  <button 
                      onClick={handleReset} 
                      className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105"
                  >
                      <RedoIcon className="w-6 h-6"/>
                      Try Again
                  </button>
              )}
            </div>
        </div>
    </main>
  );
};

export default App;
