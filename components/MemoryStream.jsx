'use client';

import { useState } from 'react';
import MemoryNode from './MemoryNode';
import { AnimatePresence } from 'framer-motion';

const MemoryStream = ({ memories, onDelete }) => {
  const [focusedMemoryId, setFocusedMemoryId] = useState(null);

  if (!memories) {
    return null; 
  }

  const handleNodeFocus = (memoryId) => {
    setFocusedMemoryId(prevFocusedId => (prevFocusedId === memoryId ? null : memoryId));
  };

  const isAnyNodeFocused = focusedMemoryId !== null;

  return (
    <div className="relative pt-2 pb-2"> 
      <AnimatePresence initial={false}> 
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