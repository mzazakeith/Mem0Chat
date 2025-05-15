'use client';

import { useState } from 'react';
import MemoryNode from './MemoryNode';
import { AnimatePresence, motion } from 'framer-motion';

const MemoryStream = ({ memories, onDelete }) => {
  const [focusedMemoryId, setFocusedMemoryId] = useState(null);

  if (!memories) {
    return null; // Or some placeholder/loading state if preferred
  }

  const handleNodeFocus = (memoryId) => {
    setFocusedMemoryId(prevFocusedId => (prevFocusedId === memoryId ? null : memoryId));
  };

  const isAnyNodeFocused = focusedMemoryId !== null;

  return (
    <div className="relative pt-2 pb-2"> {/* Add some padding for potential connector overhang */}
      <AnimatePresence initial={false}> {/* initial={false} to prevent all items animating on first load if already present */}
        {memories.map((memory, index) => (
          <MemoryNode 
            key={memory.id} 
            memory={memory} 
            onDelete={onDelete} 
            index={index} 
            isLast={index === memories.length - 1}
            isFocused={memory.id === focusedMemoryId}
            isAnyFocused={isAnyNodeFocused}
            onFocus={handleNodeFocus}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default MemoryStream; 