'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateString; // fallback
  }
};

const MemoryNode = ({ memory, onDelete, index, isLast, isFocused, isAnyFocused, onFocus }) => {
  if (!memory) return null;

  // Animation variants for Framer Motion
  const nodeVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: (custom) => ({ 
      opacity: custom.isAnyFocused ? (custom.isFocused ? 1 : 0.6) : 1,
      scale: custom.isFocused ? 1.05 : (custom.isAnyFocused ? 0.97 : 1),
      y: 0,
      zIndex: custom.isFocused ? 10 : 1, 
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: index * 0.07
      }
    }),
    exit: { 
      opacity: 0, 
      scale: 0.9, 
      x: -50, // Slide out to the left
      transition: { duration: 0.3 }
    }
  };

  return (
    <motion.div
      custom={{ isFocused, isAnyFocused }}
      variants={nodeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="mb-4 relative cursor-pointer" // Added cursor-pointer
      onClick={() => onFocus(memory.id)} // Call onFocus with this node's ID
    >
      {/* Delete Button - Top Right of the entire Node */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-[-8px] right-[-2px] text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 h-7 w-7 rounded-full transition-colors duration-200 z-40 bg-background shadow-md hover:shadow-lg" // Adjusted position, size, added bg & shadow for visibility
        onClick={() => onDelete(memory.id)}
        title="Delete memory"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Connector Line - Adjusted for new margin & card structure */}
      {index > 0 && (
        <motion.div 
          className="absolute left-[calc(50%-1px)] -top-4 w-0.5 bg-gradient-to-b z-0"
          initial={{ height: 0, opacity: 0}}
          animate={{ 
            height: '1rem', 
            opacity: isAnyFocused ? (isFocused ? 1 : 0.3) : 1, // Logic for connector based on isAnyFocused and isFocused
            backgroundImage: isFocused ? 'linear-gradient(to bottom, hsl(var(--my-primary-hsl)), hsl(var(--my-primary-hsl) / 0.7))' : 'linear-gradient(to bottom, hsl(var(--my-border-hsl) / 0.3), hsl(var(--my-border-hsl) / 0.8))'
          }}
          transition={{ duration: 0.5, delay: index * 0.07 + 0.2 }}
          style={{ bottom: 'calc(100% - 1rem)' }} 
        />
      )}

      <Card className={`group text-muted-foreground shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out rounded-lg overflow-hidden relative z-10 border-2 hover:border-primary/50 active:shadow-primary/20 active:shadow-inner ${isFocused ? 'border-primary' : 'border-transparent'} ${isFocused ? 'bg-primary/5' : 'bg-muted'}`}> 
        {/* Changed bg-card to bg-muted, text-card-foreground to text-muted-foreground */}
        {/* Added dynamic border and bg based on isFocused */}
        <CardContent className="p-3 pt-5 min-h-[60px] break-words whitespace-pre-wrap text-sm relative">
          {/* Node Anchor Point */}
          <motion.div 
            className="absolute left-[calc(50%-4px)] top-[5px] w-2 h-2 rounded-full z-20 border-2 border-background shadow-sm"
            animate={{
              scale: isFocused ? [1, 1.3, 1] : [1, 1.15, 1],
              boxShadow: isFocused ? [`0 0 3px hsl(var(--my-primary-hsl))`, `0 0 7px hsl(var(--my-primary-hsl))`, `0 0 3px hsl(var(--my-primary-hsl))`] : [`0 0 2px hsl(var(--my-primary-hsl))`, `0 0 4px hsl(var(--my-primary-hsl))`, `0 0 2px hsl(var(--my-primary-hsl))`],
              backgroundColor: isFocused ? 'hsl(var(--my-primary-hsl))' : 'hsl(var(--my-primary-hsl))' // Anchor remains primary, but could change
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: index * 0.1 }}
          />
          
          {memory.memory || memory.content}

          {/* Date - Bottom Right (Floating) */}
          <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground/80">
            {formatDate(memory.created_at || memory.createdAt || memory.timestamp)}
          </span>
        </CardContent>
        {/* CardFooter removed */}
      </Card>
    </motion.div>
  );
};

export default MemoryNode; 