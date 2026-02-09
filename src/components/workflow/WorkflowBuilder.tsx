import React, { useState } from 'react';
import { InfiniteCanvas } from './canvas/InfiniteCanvas';
import { CanvasControls } from './canvas/CanvasControls';
import { StoreProvider } from './stores/StoreContext';
import { Play, RotateCcw } from 'lucide-react';

export function WorkflowBuilder() {
  const [inputValue, setInputValue] = useState('');

  const handleSendRequest = (text: string) => {
    if (text.trim()) {
      console.log('Send request:', text);
      // TODO: Implement actual workflow execution
      setInputValue('');
    }
  };

  const handleDemo = () => {
    handleSendRequest('Research the latest AI news and create a summary report');
  };

  const handleReset = () => {
    console.log('Reset workflow');
    // TODO: Implement reset functionality
  };

  return (
    <div className="h-screen w-screen flex bg-black text-zinc-100 overflow-hidden font-sans selection:bg-amber-500/30">
      <main className="flex-1 relative overflow-hidden">
        <StoreProvider mode="demo">
          <InfiniteCanvas />
          <CanvasControls />

          {/* Demo Mode Indicator */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 font-sans">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-zinc-400 font-medium">Demo Mode</span>
          </div>

          {/* Input and Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 flex gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 shadow-xl">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter your workflow request..."
                className="w-80 bg-transparent outline-none text-zinc-300 placeholder-zinc-600"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSendRequest(inputValue);
                  }
                }}
              />
            </div>
            <button
              onClick={handleDemo}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-3 rounded-lg font-medium transition-colors shadow-xl"
            >
              <Play size={16} />
              Demo
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-lg font-medium transition-colors shadow-xl"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </StoreProvider>
      </main>
    </div>
  );
}