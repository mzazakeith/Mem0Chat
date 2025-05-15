'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  PlusSquare,
  Trash2,
  MessageSquare,
  Loader2,
  Search,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Settings 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { addChat, getAllChats, getMessagesForChat, addMessage, deleteChat as dbDeleteChat } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Brain } from 'lucide-react';
import MemoriesPanel from '@/components/MemoriesPanel';

import { ALL_AVAILABLE_MODELS, getDefaultModelForUsage, getModelConfigById } from '@/lib/models';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ChatPage() {
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [mem0UserId, setMem0UserId] = useState(null);
  const [globalMemoriesActive, setGlobalMemoriesActive] = useState(true);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [isMemoriesPanelOpen, setIsMemoriesPanelOpen] = useState(true); 
  const [globalChatModelId, setGlobalChatModelId] = useState(() => getDefaultModelForUsage('chat'));
  const [globalTitleModelId, setGlobalTitleModelId] = useState(() => getDefaultModelForUsage('title'));
  const [availableChatModels, setAvailableChatModels] = useState([]);
  const [availableTitleModels, setAvailableTitleModels] = useState([]);
  const [isModelSettingsDrawerOpen, setIsModelSettingsDrawerOpen] = useState(false);

  // Derived state for the current chat's memory setting (useChatMemories)
  const currentChatSession = chatSessions.find(cs => cs.id === activeChatId);
  const useChatMemories = currentChatSession?.useChatMemories || false;
  const currentChatModelId = currentChatSession?.modelId || globalChatModelId;

  // Initialize available models from the imported configuration
  useEffect(() => {
    setAvailableChatModels(ALL_AVAILABLE_MODELS.filter(m => m.usage.includes('chat')));
    setAvailableTitleModels(ALL_AVAILABLE_MODELS.filter(m => m.usage.includes('title')));
  }, []);

  // Effect for loading model preferences from localStorage
  useEffect(() => {
    const storedGlobalChatModelId = localStorage.getItem('globalChatModelId');
    if (storedGlobalChatModelId) {
      setGlobalChatModelId(storedGlobalChatModelId);
    } else {
      localStorage.setItem('globalChatModelId', globalChatModelId); 
    }

    const storedGlobalTitleModelId = localStorage.getItem('globalTitleModelId');
    if (storedGlobalTitleModelId) {
      setGlobalTitleModelId(storedGlobalTitleModelId);
    } else {
      localStorage.setItem('globalTitleModelId', globalTitleModelId);
    }
  }, []);

  const { messages, setMessages, input, handleInputChange, isLoading, error: apiError, reload, stop, append }
    = useChat({
    api: '/api/chat',
    id: activeChatId,
    body: {
        
    },
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
          

        } catch (e) {
          console.error("Failed to save AI message: ", e);
          setDbError("Failed to save AI response. Please try again.");
        }
      }
    },
    async onResponse(response) {
      if (!response.ok) {
        console.error("API Error:", response.statusText);
        try {
            const errorData = await response.json();
            if (errorData.error) {
                setDbError(`API Error: ${errorData.error}`); // Using dbError state for API errors too for simplicity here
            }
        } catch (e) {
            // Ignore if not JSON
        }
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
      useChatMemories: false, // Default per-chat memory setting
    };
    try {
      await addChat(newChatSession); 
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
  }, [setMessages]);

  const loadChatSessions = useCallback(async () => {
    setIsDbLoading(true);
    try {
      const sessions = await getAllChats();
      setChatSessions(sessions.sort((a,b) => b.timestamp - a.timestamp));
      if (sessions.length > 0) {
        if (!activeChatId && isInitialLoad) {
            setActiveChatId(sessions[0].id); 
        }
      } else if (isInitialLoad) {
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
  }, [activeChatId, isInitialLoad, handleNewChat]);

  useEffect(() => {
    let userId = localStorage.getItem('mem0_user_id');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('mem0_user_id', userId);
    }
    setMem0UserId(userId);

    const storedGlobalMemoriesActive = localStorage.getItem('mem0_global_active');
    if (storedGlobalMemoriesActive !== null) {
      setGlobalMemoriesActive(JSON.parse(storedGlobalMemoriesActive));
    } else {
      localStorage.setItem('mem0_global_active', JSON.stringify(true));
      setGlobalMemoriesActive(true);
    }
  }, []);

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  useEffect(() => {
    async function loadMessages() {
      if (activeChatId && !isInitialLoad) { 
        setIsDbLoading(true);
        try {
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
  }, [activeChatId, setMessages, isInitialLoad, chatSessions]); // Added chatSessions as messages might depend on its modelId indirectly affecting system prompt logic if we were to rebuild that on client

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
    if (isLoading) stop(); 
    setActiveChatId(chatId);
  };

  const handleDeleteChat = async (chatIdToDelete, event) => {
    event.stopPropagation();
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
    const currentChatIdForSubmit = activeChatId; // Capture activeChatId at submit time

    const userMessageForDisplayAndHistory = {
        id: uuidv4(),
        chatId: currentChatIdForSubmit,
        role: 'user',
        content: userMessageContent,
        createdAt: new Date()
    };
    
    const messageToAppendToSDK = {
        role: 'user',
        content: userMessageContent,
        id: userMessageForDisplayAndHistory.id, 
        createdAt: userMessageForDisplayAndHistory.createdAt
    };

    const activeSessionDetails = chatSessions.find(cs => cs.id === currentChatIdForSubmit);
    const modelIdForApi = activeSessionDetails?.modelId || globalChatModelId;
    
    console.log(`[ChatPage] Submitting message with modelId: ${modelIdForApi}`);

    let chatRequestOptions = {
        body: {
            modelId: modelIdForApi, // Pass the resolved modelId
            // Only include experimental_customTool if memories are active for this specific chat AND globally
            ...(globalMemoriesActive && useChatMemories && mem0UserId && {
                experimental_customTool: {
                    userId: mem0UserId,
                    activateMemories: true // This is true if useChatMemories is true for this chat
                }
            })
        }
    };

    handleInputChange({ target: { value: '' } }); 
    append(messageToAppendToSDK, chatRequestOptions);

    if (userMessageForDisplayAndHistory && currentChatIdForSubmit) {
        try {
            await addMessage(userMessageForDisplayAndHistory);

            const currentChatForTitle = chatSessions.find(c => c.id === currentChatIdForSubmit);
            const messagesInUIForTitleCheck = [...messages, userMessageForDisplayAndHistory]; 
            const userMessagesInCurrentChatNow = messagesInUIForTitleCheck.filter(m => m.role === 'user' && m.chatId === currentChatIdForSubmit);

            if (currentChatForTitle && currentChatForTitle.title === "New Chat" && userMessagesInCurrentChatNow.length === 1) {
                fetch('/api/generate-title', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messageContent: userMessageForDisplayAndHistory.content,
                        modelId: globalTitleModelId 
                    }),
                })
                .then(async (titleResponse) => {
                    if (titleResponse.ok) {
                        const { title: newAiTitle } = await titleResponse.json();
                        if (newAiTitle) {
                            setChatSessions(prevSessions => {
                                const updated = prevSessions.map(cs => 
                                    cs.id === currentChatIdForSubmit ? { ...cs, title: newAiTitle, timestamp: Date.now() } : cs
                                );
                                return updated.sort((a,b) => b.timestamp - a.timestamp);
                            });

                            addChat({ id: currentChatIdForSubmit, title: newAiTitle, timestamp: Date.now() })
                                .catch(dbTitleError => console.error("Failed to save AI generated title to DB:", dbTitleError));
                        } else {
                             console.warn("AI title generation returned an empty title.");
                        }
                    } else {
                        let errorDetail = titleResponse.statusText;
                        try {
                            const errorData = await titleResponse.json();
                            errorDetail = errorData?.error || errorDetail;
                        } catch (parseErr) {
                            console.warn("Could not parse error JSON from title generation API", parseErr);
                        }
                        console.error("Failed to generate title via API:", titleResponse.status, errorDetail);
                        setDbError(`Title Gen Failed: ${errorDetail}`); // Show title gen error
                    }
                })
                .catch(titleError => {
                    console.error("Error calling title generation API:", titleError);
                    setDbError(`Title Gen Network Error: ${titleError.message}`); // Show network error for title gen
                });
            }
        } catch (dbErr) {
            console.error("Failed to save user message:", dbErr);
            setDbError("Failed to save your message. Please try again.");
        }
    }
  };

  const sidebarNewChatClick = async () => {
    await handleNewChat(true);
  }

  const handleToggleGlobalMemories = (checked) => {
    setGlobalMemoriesActive(checked);
    localStorage.setItem('mem0_global_active', JSON.stringify(checked));
    console.log("Global memories active:", checked);
  };

  const handleToggleChatMemories = async (checked) => {
    if (!activeChatId) return;
    const currentChat = chatSessions.find(cs => cs.id === activeChatId);
    if (currentChat) {
      const updatedChatSession = { ...currentChat, useChatMemories: checked };
      try {
        await addChat(updatedChatSession); 
        setChatSessions(prev => prev.map(cs => cs.id === activeChatId ? updatedChatSession : cs));
      } catch (e) {
        console.error("Failed to update chat memory preference:", e);
        setDbError("Failed to save memory preference for this chat.");
      }
    }
  };

  // Handlers for model selection changes
  const handleGlobalChatModelChange = (newModelId) => {
    setGlobalChatModelId(newModelId);
    localStorage.setItem('globalChatModelId', newModelId);
    console.log("Global chat model changed to:", newModelId);
  };

  const handleGlobalTitleModelChange = (newModelId) => {
    setGlobalTitleModelId(newModelId);
    localStorage.setItem('globalTitleModelId', newModelId);
    console.log("Global title model changed to:", newModelId);
  };

  const handlePerChatModelChange = async (newModelId) => {
    if (!activeChatId) return;
    const currentChat = chatSessions.find(cs => cs.id === activeChatId);
    if (currentChat) {
      const updatedChatSession = { ...currentChat, modelId: newModelId };
      try {
        await addChat(updatedChatSession); 
        setChatSessions(prev => prev.map(cs => cs.id === activeChatId ? updatedChatSession : cs));
        console.log(`Per-chat model for ${activeChatId} changed to:`, newModelId);
      } catch (e) {
        console.error("Failed to update per-chat model preference:", e);
        setDbError("Failed to save model preference for this chat.");
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
          <div className="p-4 border-t border-border mt-auto flex flex-col space-y-4">
            {/* Drawer for Default Settings */}
            <Drawer open={isModelSettingsDrawerOpen} onOpenChange={setIsModelSettingsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-sm font-medium">
                  <Settings className="h-4 w-4 mr-2" /> Default Settings
                </Button>
              </DrawerTrigger>
              <DrawerContent data-vaul-drawer-direction="bottom">
                <div className="mx-auto w-full max-w-md p-4">
                  <DrawerHeader className="pb-2 px-0">
                    <DrawerTitle>Default Settings</DrawerTitle>
                    <DrawerDescription>
                      Configure global default behaviors for your chat experience.
                    </DrawerDescription>
                  </DrawerHeader>
                  
                  <div className="space-y-4 py-4">
                    {/* Global Memory Toggle Row  */}
                    <div className="flex items-center justify-between w-full p-2 rounded border border-border/50 bg-background/20">
                        <Label htmlFor="global-memory-toggle-drawer" className="flex items-center cursor-pointer text-sm font-medium text-foreground">
                            <Brain className="h-5 w-5 mr-2 text-primary" />
                             Memories
                        </Label>
                        <div className="flex items-center space-x-2">
                            <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                globalMemoriesActive
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                            >
                            {globalMemoriesActive ? 'Active' : 'Inactive'}
                            </span>
                            <Switch
                            id="global-memory-toggle-drawer" // Updated ID for drawer context
                            checked={globalMemoriesActive}
                            onCheckedChange={handleToggleGlobalMemories}
                            aria-label="Toggle global memories"
                            />
                        </div>
                    </div>

                    {/* Global Chat Model Selector */}
                    <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="global-chat-model-select-drawer" className="text-sm font-medium text-foreground flex items-center">
                           Default Chat Model
                        </Label>
                         <Select value={globalChatModelId} onValueChange={handleGlobalChatModelChange}>
                            <SelectTrigger id="global-chat-model-select-drawer" className="w-full h-9 text-sm">
                                <SelectValue placeholder="Select default chat model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Available Chat Models</SelectLabel>
                                    {availableChatModels.map(model => (
                                        <SelectItem key={model.id} value={model.id} title={model.name}>
                                            {model.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Global Title Model Selector */}
                    <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="global-title-model-select-drawer" className="text-sm font-medium text-foreground flex items-center">
                            Default Title Model
                        </Label>
                        <Select value={globalTitleModelId} onValueChange={handleGlobalTitleModelChange}>
                            <SelectTrigger id="global-title-model-select-drawer" className="w-full h-9 text-sm">
                                <SelectValue placeholder="Select default title model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Available Title Models</SelectLabel>
                                    {availableTitleModels.map(model => (
                                        <SelectItem key={model.id} value={model.id} title={model.name}>
                                            {model.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                  </div>

                  <DrawerFooter className="pt-2 px-0">
                    <DrawerClose asChild>
                      <Button variant="outline">Close</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
            
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
        <header className="px-6 py-5 border-b border-border shadow-sm flex items-center justify-between space-x-4">
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
          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* Per-Chat Model Selector - Only if a chat is active */}
            {activeChatId && (
              <div className="flex flex-col items-end w-52">
                <Select value={currentChatModelId} onValueChange={handlePerChatModelChange} disabled={!activeChatId}>
                    <SelectTrigger id="per-chat-model-select" className="h-9 text-sm"> 
                        <SelectValue placeholder="Select model for this chat" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Chat Model (Current Session)</SelectLabel>
                            {availableChatModels.map(model => (
                                <SelectItem key={model.id} value={model.id} title={model.name}>
                                    {getModelConfigById(model.id)?.name || model.id} 
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
              </div>
            )}
            {/* Memories Panel Toggle Button  */}
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
            {/* PER-CHAT MEMORY TOGGLE - WITH TOOLTIP */}
            {activeChatId && globalMemoriesActive && ( 
              <div className="flex items-center space-x-1.5 p-1 rounded mr-2">
                <TooltipProvider delayDuration={300}> 
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="chat-memory-toggle-footer" className="flex items-center cursor-pointer">
                        <Brain className="h-5 w-5 text-primary flex-shrink-0" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5}>
                      <p className="text-xs">
                        When active the model will consider your memories when responding.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Switch
                  id="chat-memory-toggle-footer"
                  checked={useChatMemories}
                  onCheckedChange={handleToggleChatMemories}
                  disabled={!globalMemoriesActive} 
                  aria-labelledby="chat-memory-tooltip" 
                />
                <span className={`text-xs font-medium select-none ${useChatMemories ? 'text-primary' : 'text-muted-foreground'}`}>
                  {useChatMemories ? 'On' : 'Off'}
                </span>
              </div>
            )}
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