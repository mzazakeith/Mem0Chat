'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error messages
import MemoryStream from './MemoryStream'; // Import the new MemoryStream component

// Lucide Icons
import { 
  PlusCircle, 
  Search as SearchIcon, 
  Trash2, 
  RefreshCw, 
  ListX, 
  AlertTriangle, 
  XCircle, 
  Save, 
  BrainCircuit,
  ExternalLink
} from 'lucide-react';

// DB functions (client-side IndexedDB)
import { replaceAllLocalMemoriesForUser } from '@/lib/db'; 
// We might use getAllLocalMemories for initial optimistic load if desired later - for now, API is primary source after actions.

// Helper to format date
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

const MemoriesPanel = ({ userId, globalMemoriesActive }) => {
  const [memories, setMemories] = useState([]);
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingAdd, setIsLoadingAdd] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  // Individual loading states for delete could be managed by adding an `isDeleting` map: {[memoryId]: true}

  const [searchResults, setSearchResults] = useState(null); // null: not actively searching; []: empty results; array: results
  const [error, setError] = useState(null);

  const displayedMemories = searchResults !== null ? searchResults : memories;

  // Fetch Memories (main list)
  const fetchMemories = useCallback(async () => {
    if (!globalMemoriesActive) {
      setMemories([]);
      setError(null); // Clear previous errors
      setSearchResults(null); // Clear search results
      return;
    }
    if (!userId) return;

    setIsLoadingList(true);
    setError(null);
    setSearchResults(null);
    try {
      const response = await fetch(`/api/mem0/list?userId=${encodeURIComponent(userId)}&globalMemoriesActive=true`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch memories (${response.status})`);
      }
      const data = await response.json();
      const memoriesFromApi = data.results || [];
      setMemories(memoriesFromApi);
      await replaceAllLocalMemoriesForUser(userId, memoriesFromApi); // Update local DB
    } catch (e) {
      console.error("Failed to fetch memories:", e);
      setError(e.message);
      setMemories([]); // Clear memories on error
    } finally {
      setIsLoadingList(false);
    }
  }, [userId, globalMemoriesActive]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]); // Runs when userId or globalMemoriesActive changes (due to useCallback dependencies)

  // Add Memory
  const handleAddMemory = async (e) => {
    e.preventDefault();
    if (!newMemoryInput.trim() || !userId) return;

    setIsLoadingAdd(true);
    setError(null);
    try {
      const response = await fetch('/api/mem0/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: newMemoryInput.trim() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to add memory (${response.status})`);
      }
      const data = await response.json(); // API returns all memories
      const allMemoriesFromApi = data.results || [];
      setMemories(allMemoriesFromApi);
      await replaceAllLocalMemoriesForUser(userId, allMemoriesFromApi);
      setNewMemoryInput('');
      setSearchResults(null); // Clear search on add
    } catch (e) {
      console.error("Failed to add memory:", e);
      setError(e.message);
    } finally {
      setIsLoadingAdd(false);
    }
  };

  // Delete Memory
  const handleDeleteMemory = async (memoryIdToDelete) => {
    if (!userId || !memoryIdToDelete) return;
    // Consider adding a confirmation dialog here for better UX
    
    // Optimistically remove from UI (optional, can make UI feel faster)
    // const prevMemories = memories;
    // setMemories(m => m.filter(mem => mem.id !== memoryIdToDelete));
    setError(null);

    try {
      const response = await fetch('/api/mem0/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, memoryId: memoryIdToDelete }),
      });
      if (!response.ok) {
        const errData = await response.json();
        // setMemories(prevMemories); // Revert optimistic update
        throw new Error(errData.error || `Failed to delete memory (${response.status})`);
      }
      const data = await response.json(); // API returns all memories
      const allMemoriesFromApi = data.results || [];
      setMemories(allMemoriesFromApi);
      await replaceAllLocalMemoriesForUser(userId, allMemoriesFromApi);
      setSearchResults(null); // Clear search on delete
    } catch (e) {
      console.error("Failed to delete memory:", e);
      setError(e.message);
      // If not doing optimistic updates, or if API failed after optimistic, ensure list is accurate:
      // await fetchMemories(); // Or rely on the fact that the main list `memories` wasn't changed if error
    } finally {
      // Add specific loading state for this memory item if needed
    }
  };

  // Search Memories
  const handleSearchMemories = async (e) => {
    e.preventDefault();
    if (!searchInput.trim() || !userId) {
      setSearchResults(null); // Clear search if input is empty
      return;
    }

    setIsLoadingSearch(true);
    setError(null);
    try {
      const response = await fetch(`/api/mem0/search?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(searchInput.trim())}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to search memories (${response.status})`);
      }
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.error("Failed to search memories:", e);
      setError(e.message);
      setSearchResults([]); // Show empty search results on error
    } finally {
      setIsLoadingSearch(false);
    }
  };
  
  const clearSearch = () => {
    setSearchInput('');
    setSearchResults(null);
    setError(null);
  }

  // Sync Memories
  const handleSyncMemories = async () => {
    if (!userId) return;

    setIsLoadingSync(true);
    setError(null);
    try {
      const response = await fetch('/api/mem0/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to sync memories (${response.status})`);
      }
      const data = await response.json(); // API returns all memories
      const allMemoriesFromApi = data.results || [];
      setMemories(allMemoriesFromApi);
      await replaceAllLocalMemoriesForUser(userId, allMemoriesFromApi);
      setSearchResults(null); // Clear search on sync
    } catch (e) {
      console.error("Failed to sync memories:", e);
      setError(e.message);
    } finally {
      setIsLoadingSync(false);
    }
  };

  if (!globalMemoriesActive) {
    return (
      <Card className="h-full flex flex-col bg-primary text-card-foreground rounded-lg shadow-md">
        <CardHeader className="p-4 border-b border-border">
          <CardTitle className="flex items-center text-lg font-semibold text-foreground">
            <BrainCircuit className="mr-2 h-5 w-5 text-primary" /> Memory Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col items-center justify-center text-center p-4">
          <BrainCircuit className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-lg font-semibold text-foreground">Memories Disabled</p>
          <p className="text-sm text-muted-foreground">Global memories are currently turned off.</p>
          <p className="text-xs text-muted-foreground mt-2">Enable them in the sidebar settings to use this feature.</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!userId) {
     return (
      <Card className="h-full flex flex-col bg-card text-card-foreground rounded-lg shadow-md">
        <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-lg font-semibold text-foreground">Memory Panel</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-4"> 
          <Skeleton className="w-10 h-10 rounded-full mr-3" /> 
          <span className="text-muted-foreground">Initializing User for Memories...</span>
        </CardContent>
      </Card>
     );
  }

  return (
    <Card className="h-full flex flex-col bg-card text-card-foreground rounded-lg shadow-lg">
      <CardHeader className="p-4 border-b border-border">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-lg font-semibold text-foreground">
            <BrainCircuit className="mr-2 h-5 w-5 text-primary" /> My Memories
          </CardTitle>
          <Button onClick={handleSyncMemories} variant="outline" size="sm" disabled={isLoadingSync || isLoadingList}>
            <RefreshCw className={`mr-1 h-3 w-3 ${isLoadingSync ? 'animate-spin' : ''}`} />
            {isLoadingSync ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-grow flex flex-col overflow-hidden">
        {/* Add Memory Form */}
        <form 
          onSubmit={handleAddMemory} 
          className="p-4 border-b border-border flex items-center space-x-2"
        >
          <Textarea
            placeholder="Write down a memory..."
            value={newMemoryInput}
            onChange={(e) => setNewMemoryInput(e.target.value)}
            rows={1}
            className="text-sm resize-none flex-grow rounded-md border border-input bg-transparent px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoadingAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Basic check, actual validation is on button's disabled state
                if (!isLoadingAdd && newMemoryInput.trim()) {
                  handleAddMemory(e); 
                }
              }
            }}
          />
          <Button 
            type="submit" 
            size="default" // Default size to match textarea height
            variant="default"
            className="aspect-square p-2.5" // Make it square, adjust padding for icon
            disabled={isLoadingAdd || !newMemoryInput.trim()}
            title="Add Memory"
          >
            <PlusCircle className="h-5 w-5" />
          </Button>
        </form>

        {/* Search Form */}
        <form onSubmit={handleSearchMemories} className="p-4 border-b border-border flex items-center space-x-2">
          <Input
            type="search"
            placeholder="Search memories..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="text-sm flex-grow"
            disabled={isLoadingSearch}
          />
          <Button type="submit" variant="secondary" size="icon" disabled={isLoadingSearch}>
            <SearchIcon className="h-4 w-4" />
          </Button>
          {searchResults !== null && (
            <Button variant="ghost" size="icon" onClick={clearSearch} title="Clear search">
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </form>
        
        {error && (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <ScrollArea className="flex-grow p-1">
          <div className="p-2 space-y-0">
            {isLoadingList && (!memories || memories.length === 0) && (
              <div className="p-4 space-y-3">
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            )}
            {/* Render Memory Stream */}
            {!isLoadingList && displayedMemories.length > 0 && (
              <MemoryStream memories={displayedMemories} onDelete={handleDeleteMemory} />
            )}
            {/* No memories / No search results message - handled within MemoriesPanel before calling MemoryStream */}
            {!isLoadingList && displayedMemories.length === 0 && !error && (
              <div className="text-center py-10 px-4">
                <ListX className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">
                  {searchResults !== null ? "No memories found for your search." : "No memories yet."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchResults !== null ? "Try a different search term." : "Add some memories using the form above."}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default MemoriesPanel; 