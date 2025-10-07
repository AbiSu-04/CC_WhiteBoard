'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Define the types for our drawing data
type Point = { x: number; y: number };
type Draw = {
  path: Point[];
  color: string;
  linewidth: number;
};

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<Point[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);

  // ✨ MOVED: This function is now outside of useEffect
  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const drawPath = (draw: Draw) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !draw.path || draw.path.length < 2) return;

    ctx.strokeStyle = draw.color;
    ctx.lineWidth = draw.linewidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(draw.path[0].x, draw.path[0].y);
    for (let i = 1; i < draw.path.length; i++) {
      ctx.lineTo(draw.path[i].x, draw.path[i].y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const channel = supabase.channel('whiteboard-drawings');

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'drawings' },
      (payload) => {
        const newDraw = payload.new as Draw;
        drawPath(newDraw);
      }
    );

    channel.on('broadcast', { event: 'clear' }, () => {
      clearCanvasLocal(); // This still listens for messages from others
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
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
    } else if (event.touches && event.touches.length > 0) {
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    } else {
      return null;
    }
    return { x, y };
  };

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

  // ✨ UPDATED: This now clears locally AND sends the broadcast
  const clearCanvas = () => {
    // 1. Clear our own board immediately
    clearCanvasLocal();
    // 2. Tell everyone else to clear their board
    channelRef.current?.send({
      type: 'broadcast',
      event: 'clear',
    });
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-center space-x-4 mb-4 p-2 bg-gray-100 rounded-md shadow-md">
        <label htmlFor="color" className="text-black font-medium">Color:</label>
        <input
          type="color"
          id="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 border-none cursor-pointer"
        />
        <label htmlFor="lineWidth" className="text-black font-medium">Width:</label>
        <input
          type="range"
          id="lineWidth"
          min="1"
          max="20"
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          className="cursor-pointer"
        />
        <span className="text-black">{lineWidth}</span>
        <button
          onClick={clearCanvas}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-2 border-gray-300 rounded-lg shadow-lg bg-white"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default Whiteboard;