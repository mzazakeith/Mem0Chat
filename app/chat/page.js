'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from 'ai/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, PlusSquare, Trash2, MessageSquare, Loader2, Search, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { addChat, getAllChats, getMessagesForChat, addMessage, deleteChat as dbDeleteChat } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { ThemeToggle } from '@/components/ThemeToggle'; // Assuming components alias is to root/components
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Brain } from 'lucide-react'; // Icon for memory toggle
import MemoriesPanel from '@/components/MemoriesPanel'; // Import the new panel


export default function ChatPage() {
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open on larger screens, can be toggled
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [mem0UserId, setMem0UserId] = useState(null);
  const [globalMemoriesActive, setGlobalMemoriesActive] = useState(true); // Default to true
  const [useChatMemories, setUseChatMemories] = useState(false); // Default to false for per-chat memory usage
  const [chatSearchTerm, setChatSearchTerm] = useState(''); // New state for chat search
  const [isMemoriesPanelOpen, setIsMemoriesPanelOpen] = useState(true); // New state for MemoriesPanel visibility

  const { messages, setMessages, input, handleInputChange, isLoading, error: apiError, reload, stop, append }
    = useChat({
    api: '/api/chat',
    id: activeChatId,
    sendExtraMessageFields: true,
    async onFinish(message) {
      if (activeChatId && message.role === 'assistant') {
        try {
          const aiMessageToSave = { 
            id: message.id, 
            chatId: activeChatId, 
            role: message.role, 
            content: message.content, 
            createdAt: message.createdAt
          };

          if (!aiMessageToSave.id || !aiMessageToSave.createdAt) {
            console.warn("AI Message from onFinish was missing id or createdAt, generating fallbacks.", message);
            if (!aiMessageToSave.id) aiMessageToSave.id = uuidv4();
            if (!aiMessageToSave.createdAt) aiMessageToSave.createdAt = new Date();
          }

          await addMessage(aiMessageToSave);
          
          // Title generation logic is moved to handleFormSubmit based on the first user message.
          // The title will be updated there if it's a new chat.

        } catch (e) {
          console.error("Failed to save AI message: ", e);
          setDbError("Failed to save AI response. Please try again.");
        }
      }
    },
    async onResponse(response) {
      if (!response.ok) {
        console.error("API Error:", response.statusText);
      }
    },
  });

  const scrollAreaRef = useRef(null);
  const viewportRef = useRef(null);

  const handleNewChat = useCallback(async (makeActive = true) => {
    const newChatId = uuidv4();
    const newChatSession = { 
      id: newChatId, 
      title: 'New Chat', 
      timestamp: Date.now(),
      useChatMemories: false // Default for new chats
    };
    try {
      await addChat(newChatSession); // addChat now uses put
      setChatSessions(prevSessions => [newChatSession, ...prevSessions].sort((a,b) => b.timestamp - a.timestamp));
      if (makeActive) {
        setActiveChatId(newChatId);
        setMessages([]);
      }
      setDbError(null);
      return newChatId;
    } catch (e) {
      console.error("Failed to create new chat:", e);
      setDbError("Could not create new chat.");
      return null;
    }
  }, [setMessages]); // Added setMessages to dependencies as it's used indirectly

  const loadChatSessions = useCallback(async () => {
    setIsDbLoading(true);
    try {
      const sessions = await getAllChats();
      setChatSessions(sessions.sort((a,b) => b.timestamp - a.timestamp)); // Ensure sorted
      if (sessions.length > 0) {
        if (!activeChatId && isInitialLoad) {
            setActiveChatId(sessions[0].id); 
        }
      } else if (isInitialLoad) {
        // If no chats exist on initial load, create one and make it active
        await handleNewChat(true);
      }
      setDbError(null);
    } catch (e) {
      console.error("Failed to load/create chat sessions:", e);
      setDbError("Could not load or initialize chat history.");
    } finally {
      setIsDbLoading(false);
      setIsInitialLoad(false);
    }
  }, [activeChatId, isInitialLoad, handleNewChat]); // handleNewChat is now a dependency

  useEffect(() => {
    // Initialize Mem0 User ID
    let userId = localStorage.getItem('mem0_user_id');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('mem0_user_id', userId);
    }
    setMem0UserId(userId);

    // Initialize Global Memories Active setting
    const storedGlobalMemoriesActive = localStorage.getItem('mem0_global_active');
    if (storedGlobalMemoriesActive !== null) {
      setGlobalMemoriesActive(JSON.parse(storedGlobalMemoriesActive));
    } else {
      // Default to true if not set, and store it
      localStorage.setItem('mem0_global_active', JSON.stringify(true));
      setGlobalMemoriesActive(true);
    }
  }, []);

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]); // loadChatSessions will only change if its dependencies change

  useEffect(() => {
    async function loadMessages() {
      if (activeChatId && !isInitialLoad) { // Only load if not initial (initial load or new chat handles it)
        setIsDbLoading(true);
        try {
          // Load chat session details to get useChatMemories preference
          const currentChatSession = chatSessions.find(cs => cs.id === activeChatId);
          if (currentChatSession) {
            setUseChatMemories(currentChatSession.useChatMemories || false);
          }

          const savedMessages = await getMessagesForChat(activeChatId);
          const currentHookMessageIds = new Set(messages.map(m => m.id));
          const newMessagesFromDb = savedMessages.filter(dbMsg => !currentHookMessageIds.has(dbMsg.id));
          
          const combined = [];
          const allPossibleMessages = [...messages, ...newMessagesFromDb];
          const uniqueMessages = allPossibleMessages.reduce((acc, current) => {
            if (!acc.find(item => item.id === current.id)) {
              acc.push(current);
            }
            return acc;
          }, []);

          uniqueMessages.sort((a,b) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());
          setMessages(uniqueMessages);
          setDbError(null);
        } catch (e) {
          console.error("Failed to load messages for chat:", e);
          setDbError("Could not load messages for this chat.");
          setMessages([]);
        } finally {
          setIsDbLoading(false);
        }
      }
    }
    if(activeChatId && !isInitialLoad) loadMessages();
    else if (!activeChatId) setMessages([]);
  }, [activeChatId, setMessages, isInitialLoad]); // Added isInitialLoad

  useEffect(() => {
    if (scrollAreaRef.current && !viewportRef.current) {
      const viewportElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewportElement) viewportRef.current = viewportElement;
    }
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectChat = (chatId) => {
    if (isLoading) stop(); // Stop any ongoing stream if switching chats
    setActiveChatId(chatId);
    // When selecting a chat, also load its useChatMemories preference
    const selectedChat = chatSessions.find(cs => cs.id === chatId);
    if (selectedChat) {
      setUseChatMemories(selectedChat.useChatMemories || false);
    }
  };

  const handleDeleteChat = async (chatIdToDelete, event) => {
    event.stopPropagation(); // Prevent chat selection when clicking delete
    if (isLoading && activeChatId === chatIdToDelete) stop();
    try {
      await dbDeleteChat(chatIdToDelete);
      const updatedSessions = chatSessions.filter(s => s.id !== chatIdToDelete);
      setChatSessions(updatedSessions);
      if (activeChatId === chatIdToDelete) {
        if (updatedSessions.length > 0) {
          setActiveChatId(updatedSessions[0].id);
        } else {
          setActiveChatId(null);
          setMessages([]);
        }
      }
      setDbError(null);
    } catch (e) {
      console.error("Failed to delete chat:", e);
      setDbError("Could not delete chat.");
    }
  };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChatId || isLoading) return;

    const userMessageContent = input;
    const currentChatId = activeChatId; // We might still need this if constructing message for local display or DB before append

    // This object represents the core content of the user's message
    const userMessageForDisplayAndHistory = {
        id: uuidv4(),
        chatId: currentChatId, // Useful for adding to local DB
        role: 'user',
        content: userMessageContent,
        createdAt: new Date()
    };
    
    // This is the object that will be passed to append(). 
    // For Vercel AI SDK, it should contain just the core message fields. 
    // Extra data for the request body is handled by chatRequestOptions.
    const messageToAppendToSDK = {
        role: 'user',
        content: userMessageContent,
        // id and createdAt can be omitted if we let the SDK/server handle them for the actual stream,
        // but useful if we want to immediately add a fully formed message to UI optimistically with our own ID.
        // For simplicity with `sendExtraMessageFields` not behaving as intuitively expected, we ensure this object is clean.
        // Let's keep id and createdAt for optimistic UI updates if useChat doesn't overwrite.
        id: userMessageForDisplayAndHistory.id, 
        createdAt: userMessageForDisplayAndHistory.createdAt
    };

    let chatRequestOptions = {};

    if (globalMemoriesActive && useChatMemories && mem0UserId) {
      // These fields will be sent at the top level of the request body
      chatRequestOptions.body = {
        experimental_customTool: {
          userId: mem0UserId,
          activateMemories: true
        }
      };
    }

    handleInputChange({ target: { value: '' } }); 
    
    // append the clean message, and provide chatRequestOptions for the body
    append(messageToAppendToSDK, chatRequestOptions);

    // Save the full message (with our own chatId) to local DB immediately
    if (userMessageForDisplayAndHistory && currentChatId) {
        try {
            await addMessage(userMessageForDisplayAndHistory);

            const currentChat = chatSessions.find(c => c.id === currentChatId);
            // Use messages from useChat hook state + the new message for title generation logic
            const messagesInUIForTitleCheck = [...messages, userMessageForDisplayAndHistory]; 
            const userMessagesInCurrentChatNow = messagesInUIForTitleCheck.filter(m => m.role === 'user' && m.chatId === currentChatId);

            if (currentChat && currentChat.title === "New Chat" && userMessagesInCurrentChatNow.length === 1) {
                // Fire-and-forget promise for title generation
                fetch('/api/generate-title', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ messageContent: userMessageForDisplayAndHistory.content }),
                })
                .then(async (titleResponse) => { // Add async here to use await inside
                    if (titleResponse.ok) {
                        const { title: newAiTitle } = await titleResponse.json();
                        if (newAiTitle) {
                            setChatSessions(prevSessions => {
                                const updated = prevSessions.map(cs => 
                                    cs.id === currentChatId ? { ...cs, title: newAiTitle, timestamp: Date.now() } : cs
                                );
                                return updated.sort((a,b) => b.timestamp - a.timestamp);
                            });
                            // Intentionally not awaiting addChat here to keep the primary flow non-blocking
                            // However, this means DB update for title is fire-and-forget too.
                            // If DB consistency for title is paramount and failure needs handling, this could be awaited
                            // but that might re-introduce a slight delay or require more complex state management
                            // For a "quiet" update, this is usually acceptable.
                            addChat({ id: currentChatId, title: newAiTitle, timestamp: Date.now() })
                                .catch(dbTitleError => console.error("Failed to save AI generated title to DB:", dbTitleError));
                        } else {
                             console.warn("AI title generation returned an empty title.");
                        }
                    } else {
                        // Try to get error message from response, but don't let it crash
                        let errorDetail = titleResponse.statusText;
                        try {
                            const errorData = await titleResponse.json();
                            errorDetail = errorData?.error || errorDetail;
                        } catch (e) {
                            console.warn("Could not parse error JSON from title generation API");
                        }
                        console.error("Failed to generate title via API:", titleResponse.status, errorDetail);
                        // Not setting dbError to keep title generation failure quiet
                    }
                })
                .catch(titleError => {
                    console.error("Error calling title generation API:", titleError);
                    // Not setting dbError to keep title generation failure quiet
                });
            }
        } catch (dbErr) {
            console.error("Failed to save user message:", dbErr); // Clarified error source
            setDbError("Failed to save your message. Please try again.");
        }
    }
  };

  const sidebarNewChatClick = async () => {
    await handleNewChat(true); // Always make active when user clicks new chat button
  }

  const handleToggleGlobalMemories = (checked) => {
    setGlobalMemoriesActive(checked);
    localStorage.setItem('mem0_global_active', JSON.stringify(checked));
    // Here you might want to trigger a re-fetch or sync if memories were previously off and are now on
    // For now, it just updates the state and local storage. The MemoriesPanel component will react to this prop change.
    console.log("Global memories active:", checked);
  };

  const handleToggleChatMemories = async (checked) => {
    if (!activeChatId) return;
    setUseChatMemories(checked);
    const currentChat = chatSessions.find(cs => cs.id === activeChatId);
    if (currentChat) {
      const updatedChatSession = { ...currentChat, useChatMemories: checked };
      try {
        await addChat(updatedChatSession); 
        setChatSessions(prev => prev.map(cs => cs.id === activeChatId ? updatedChatSession : cs));
      } catch (e) {
        console.error("Failed to update chat memory preference:", e);
        setDbError("Failed to save memory preference for this chat.");
        setUseChatMemories(!checked); 
      }
    }
  };

  const toggleMemoriesPanel = () => {
    setIsMemoriesPanelOpen(prev => !prev);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */} 
      <AnimatePresence>
      {isSidebarOpen && (
        <motion.div 
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', stiffness: 180, damping: 26, mass: 1.1 }}
          className="w-64 md:w-72 lg:w-80 flex flex-col border-r border-border bg-card shadow-lg h-full relative"
        >
          <div className="px-4 py-5 flex justify-between items-center border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Chat History</h2>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" onClick={sidebarNewChatClick} title="New Chat" className="hover:bg-primary/10 hover:text-primary">
                <PlusSquare className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} title="Close Sidebar" className="hidden md:inline-flex hover:bg-destructive/10 hover:text-destructive">
                <PanelLeftClose className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="p-3 border-b border-border"> {/* Slightly less padding for search bar container, consider removing border if input has enough emphasis */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search chats..."
                className="w-full rounded-lg bg-background pl-8 h-9" // bg-background for input to stand out on bg-card
                value={chatSearchTerm}
                onChange={(e) => setChatSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {isDbLoading && chatSessions.length === 0 && (
            <div className="flex-grow flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <ScrollArea className="flex-grow min-h-0">
            {chatSessions.length === 0 && !isDbLoading && (
                <div className="p-4 text-center text-muted-foreground">
                    <MessageSquare className="mx-auto h-10 w-10 mb-2" />
                    No chats yet. Start a new one!
                </div>
            )}
            {chatSessions
              .filter(session => session.title.toLowerCase().includes(chatSearchTerm.toLowerCase()))
              .map(session => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 mx-2 my-1 rounded-lg cursor-pointer transition-colors ${
                  activeChatId === session.id ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted'
                }`}
                onClick={() => handleSelectChat(session.id)}
              >
                <div className="flex justify-between items-center w-full">
                    <span className="truncate pr-2 min-w-0" title={session.title}>{session.title}</span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="hover:bg-destructive/20 hover:text-destructive flex-shrink-0"
                        onClick={(e) => handleDeleteChat(session.id, e)} 
                        title="Delete Chat"
                    >
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                </div>
              </motion.div>
            ))}
          </ScrollArea>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border mt-auto flex flex-col space-y-3">
            {/* Global Memory Toggle Row */}
            <div className="flex items-center justify-between w-full p-1 rounded">
              <Label htmlFor="global-memory-toggle" className="flex items-center cursor-pointer text-sm font-medium text-foreground">
                <Brain className="h-5 w-5 mr-2 text-primary" /> {/* Icon color from primary */}
                Global Memories
              </Label>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    globalMemoriesActive
                      ? 'bg-primary/20 text-primary' // Updated pill colors
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {globalMemoriesActive ? 'Active' : 'Inactive'}
                </span>
                <Switch
                  id="global-memory-toggle"
                  checked={globalMemoriesActive}
                  onCheckedChange={handleToggleGlobalMemories}
                  aria-label="Toggle global memories"
                  // className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-purple-200" // Default primary will be used
                />
              </div>
            </div>
            
            {/* Theme Toggle Row */}
            <div className="flex items-center justify-center w-full pt-2"> 
              <ThemeToggle />
            </div>
          </div>

          <Button className="md:hidden m-2" variant="outline" onClick={() => setIsSidebarOpen(false)}>Close</Button>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Main Chat Area */} 
      <div className="flex flex-col flex-grow h-full min-w-0"> {/* Added min-w-0 here for flex-grow */}
        <header className="px-6 py-5 border-b border-border shadow-sm flex items-center justify-between">
          <div className="flex items-center min-w-0"> {/* Added min-w-0 for title truncation */}
            {!isSidebarOpen && (
                <Button variant="ghost" size="icon" className="mr-2 hover:bg-primary/10 hover:text-primary" onClick={() => setIsSidebarOpen(true)} title="Open Sidebar">
                    <PanelLeftOpen className="h-5 w-5" />
                </Button>
            )}
            <h1 className="text-xl md:text-2xl font-semibold truncate text-foreground">
              {activeChatId ? chatSessions.find(s => s.id === activeChatId)?.title : 'AI Chat'}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            {/* Per-Chat Memory Toggle */}
            {activeChatId && (
              <div className="flex items-center space-x-2 p-1 rounded">
                <Label htmlFor="chat-memory-toggle" className="flex items-center cursor-pointer text-sm font-medium text-foreground">
                  <Brain className="h-5 w-5 mr-2 text-primary" />
                  Chat Memories
                </Label>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      useChatMemories
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {useChatMemories ? 'Active' : 'Inactive'}
                  </span>
                  <Switch
                    id="chat-memory-toggle"
                    checked={useChatMemories}
                    onCheckedChange={handleToggleChatMemories}
                    disabled={!globalMemoriesActive} 
                    title={globalMemoriesActive ? "Toggle memory usage for this chat" : "Global memories are disabled"}
                  />
                </div>
              </div>
            )}
            {/* Memories Panel Toggle Button */}
            {globalMemoriesActive && mem0UserId && (
              <Button variant="ghost" size="icon" onClick={toggleMemoriesPanel} title={isMemoriesPanelOpen ? "Close Memories Panel" : "Open Memories Panel"} className="hover:bg-primary/10 hover:text-primary">
                {isMemoriesPanelOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </header>

        <ScrollArea className="flex-grow p-6 space-y-4 min-h-0" ref={scrollAreaRef}>
          <div className="flex flex-col space-y-4 pb-4">
            {isDbLoading && messages.length === 0 && (
                <div className="flex-grow flex items-center justify-center h-full min-h-[calc(100vh-250px)]">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                </div> 
            )}
            {!activeChatId && !isDbLoading && (
                <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-250px)]">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="text-center p-8 bg-card rounded-lg shadow-md" // Use bg-card
                    >
                      <MessageSquare className="mx-auto h-12 w-12 mb-4 text-primary" />
                      <h2 className="text-2xl font-semibold mb-2 text-foreground">Welcome to AI Chat!</h2>
                      <p className="text-muted-foreground mb-4">Select a chat from the sidebar or start a new one.</p>
                      <Button onClick={sidebarNewChatClick}>
                        <PlusSquare className="mr-2 h-5 w-5" /> New Chat
                      </Button>
                    </motion.div>
                  </div>
            )}
            {activeChatId && messages.length === 0 && !isLoading && !isDbLoading && (
              <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-250px)]">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <h2 className="text-2xl font-semibold mb-2 text-foreground">Conversation Cleared or Empty</h2>
                  <p className="text-muted-foreground">Type a message to start the chat.</p>
                </motion.div>
              </div>
            )}
            {messages.map((m, index) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`flex flex-col p-3 md:p-4 rounded-xl shadow-md max-w-xl lg:max-w-2xl break-words whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground self-end ml-auto'
                    : 'bg-card text-card-foreground self-start mr-auto border border-border/50'
                }`}
              >
                <span className="font-semibold capitalize pb-1">{m.role === 'user' ? 'You' : 'AI'}</span>
                {m.content}
                 {m.createdAt && <div className="text-xs opacity-75 pt-1 text-right">{new Date(m.createdAt).toLocaleTimeString()}</div>}
              </motion.div>
            ))}
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2 self-start mr-auto p-3 md:p-4 rounded-xl shadow-md bg-card text-card-foreground max-w-xl lg:max-w-2xl border border-border/50"
                >
                    <span className="font-semibold capitalize">AI</span>
                    <div className="flex space-x-1">
                        <motion.div animate={{ opacity: [0.5, 1, 0.5], y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} className="w-2 h-2 bg-current rounded-full" />
                        <motion.div animate={{ opacity: [0.5, 1, 0.5], y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-2 h-2 bg-current rounded-full" />
                        <motion.div animate={{ opacity: [0.5, 1, 0.5], y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-2 h-2 bg-current rounded-full" />
                    </div>
                </motion.div>
            )}
            {(apiError || dbError) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 text-destructive-foreground border border-destructive/30 p-4 rounded-lg text-center my-4"
              >
                <p className="font-semibold">Error:</p>
                <p>{apiError?.message || dbError}</p>
                {apiError && <Button onClick={() => reload()} variant="outline" size="sm" className="mt-2">Retry API Request</Button>}
                {dbError && <Button onClick={loadChatSessions} variant="outline" size="sm" className="mt-2 ml-2">Retry DB Load</Button>}
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <footer className="px-6 py-4 border-t border-border bg-transparent"> {/* Or bg-muted/20 for subtle separation */}
          <form onSubmit={handleFormSubmit} className="flex items-center space-x-2">
            <Input
              className="flex-grow"
              value={input}
              placeholder={isDbLoading && !activeChatId ? "Loading chats..." : (activeChatId ? "Type your message..." : "Select or create a chat to begin")}
              onChange={handleInputChange}
              disabled={isLoading || !activeChatId || isDbLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim() || !activeChatId || isDbLoading}>
              <Send className="w-5 h-5" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </footer>
      </div>

      {/* Memories Panel Area */}
      <AnimatePresence>
        {globalMemoriesActive && mem0UserId && isMemoriesPanelOpen && (
          <motion.div 
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 26, mass: 1.1 }}
            className="w-96 hidden md:flex flex-col h-full border-l border-border bg-card shadow-lg"
          >
            <MemoriesPanel 
              userId={mem0UserId} 
              globalMemoriesActive={globalMemoriesActive} 
              togglePanel={toggleMemoriesPanel} // Pass the toggle function
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 