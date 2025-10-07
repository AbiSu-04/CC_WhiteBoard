// components/Whiteboard.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Define the types for our drawing data
type Point = { x: number; y: number };
type Draw = {
  path: Point[];
  color: string;
  lineWidth: number;
};

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);

  // Function to draw a complete path on the canvas
  const drawPath = (draw: Draw) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !draw.path || draw.path.length < 2) return;

    ctx.strokeStyle = draw.color;
    ctx.lineWidth = draw.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(draw.path[0].x, draw.path[0].y);
    for (let i = 1; i < draw.path.length; i++) {
      ctx.lineTo(draw.path[i].x, draw.path[i].y);
    }
    ctx.stroke();
  };

  // REAL-TIME SUBSCRIPTION: Set up Supabase channel
  useEffect(() => {
    const channel = supabase
      .channel('whiteboard-drawings')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'drawings' },
        (payload) => {
          // When we receive a new drawing, draw it on the canvas
          const newDraw = payload.new as Draw;
          drawPath(newDraw);
        }
      )
      .subscribe();

    // Cleanup function to remove the channel subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getCoordinates = (event: MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let x, y;
    if (event instanceof MouseEvent) {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else if (event.touches[0]) {
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    } else {
      return null;
    }
    return { x, y };
  };

  // MOUSE DOWN: Start drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getCoordinates(e.nativeEvent);
    if (!coords) return;

    currentPathRef.current = [coords];

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  // MOUSE MOVE: Continue drawing
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const coords = getCoordinates(e.nativeEvent);
    if (!coords) return;

    currentPathRef.current.push(coords);

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  // MOUSE UP: Finish drawing and send to Supabase
  const handleMouseUp = async () => {
    setIsDrawing(false);

    if (currentPathRef.current.length > 1) {
      const { error } = await supabase.from('drawings').insert({
        path: currentPathRef.current,
        color: color,
        linewidth: lineWidth,
      });
        if (error) {
            console.error('Error saving drawing:', JSON.stringify(error, null, 2));
}
    }

    currentPathRef.current = [];
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if(ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // NOTE: This only clears the local canvas. For a full "clear" feature,
      // you would need to handle deleting records in the Supabase table.
    }
  }

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-center space-x-4 mb-4 p-2 bg-gray-100 rounded-md shadow-md">
        <label htmlFor="color">Color:</label>
        <input
          type="color"
          id="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 border-none cursor-pointer"
        />
        <label htmlFor="lineWidth">Width:</label>
        <input
          type="range"
          id="lineWidth"
          min="1"
          max="20"
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          className="cursor-pointer"
        />
        <span>{lineWidth}</span>
        <button onClick={clearCanvas} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-2 border-gray-300 rounded-lg shadow-lg bg-white"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Stop drawing if mouse leaves canvas
      />
    </div>
  );
};

export default Whiteboard;