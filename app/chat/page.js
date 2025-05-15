'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from 'ai/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, PlusSquare, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { addChat, getAllChats, getMessagesForChat, addMessage, deleteChat as dbDeleteChat } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { ThemeToggle } from '@/components/ThemeToggle'; // Assuming components alias is to root/components

const CHAT_TITLE_MAX_LENGTH = 30;

function generateChatTitle(firstMessageContent) {
  if (!firstMessageContent) return "New Chat";
  const words = firstMessageContent.split(' ');
  if (words.length <= 5) {
    return firstMessageContent;
  }
  return words.slice(0, 5).join(' ') + '...';
}

export default function ChatPage() {
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open on larger screens, can be toggled
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
          
          const currentChat = chatSessions.find(c => c.id === activeChatId);
          const currentMessagesFromHook = messages;
          if (currentChat && currentChat.title === "New Chat" && currentMessagesFromHook.length >= 1) {
            let userMessageForTitle = null;
            if (currentMessagesFromHook.length >=1 && currentMessagesFromHook[currentMessagesFromHook.length - 2]?.role === 'user') {
                 userMessageForTitle = currentMessagesFromHook[currentMessagesFromHook.length - 2];
            } else if (currentMessagesFromHook.find(m => m.role === 'user')) {
                 userMessageForTitle = currentMessagesFromHook.find(m => m.role === 'user');
            }

            if (userMessageForTitle) {
                const newTitle = generateChatTitle(userMessageForTitle.content);
                const updatedSessions = chatSessions.map(cs => 
                    cs.id === activeChatId ? { ...cs, title: newTitle, timestamp: Date.now() } : cs
                );
                setChatSessions(updatedSessions.sort((a,b) => b.timestamp - a.timestamp));
                await addChat({ id: activeChatId, title: newTitle, timestamp: Date.now() });
            }
          }
        } catch (e) {
          console.error("Failed to save AI message or update title: ", e);
          setDbError("Failed to save AI response or update chat title. Please try again.");
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
    const newChatSession = { id: newChatId, title: 'New Chat', timestamp: Date.now() };
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
    loadChatSessions();
  }, [loadChatSessions]); // loadChatSessions will only change if its dependencies change

  useEffect(() => {
    async function loadMessages() {
      if (activeChatId && !isInitialLoad) { // Only load if not initial (initial load or new chat handles it)
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
    const currentChatId = activeChatId;

    // Create the full user message object *before* calling append
    const userMessage = {
        id: uuidv4(), // Generate client-side ID
        chatId: currentChatId,
        role: 'user',
        content: userMessageContent,
        createdAt: new Date() // Generate client-side timestamp
    };

    // Clear input before calling append, which might take time
    handleInputChange({ target: { value: '' } }); 

    // Append expects just role and content, but we send the full object to get it back with potential enhancements.
    // However, the actual saving will use our locally created 'userMessage'.
    append(userMessage); // Pass the full user message object

    // Save the locally created user message to DB immediately
    if (userMessage && currentChatId) {
        try {
            await addMessage(userMessage); // Save the complete userMessage object

            const currentChat = chatSessions.find(c => c.id === currentChatId);
            // Check if this is the first user message in a "New Chat"
            // To do this, we'll look at the messages currently in the UI from useChat hook,
            // *after* our new message has been added to it by append().
            // Since append() updates messages optimistically and asynchronously,
            // we might need a slight delay or rely on the fact that setMessages inside useChat is synchronous enough.
            
            // Let's refine the logic for title update. We check the actual DB messages or a fresh load.
            // For simplicity here, we'll assume that if the title is "New Chat" and this is a user message,
            // it's a good candidate for updating the title. A more robust check would involve counting user messages in DB.
            const messagesInUI = messages; // This will include the new user message optimistically
            const userMessagesInCurrentChatNow = messagesInUI.filter(m => m.role === 'user' && m.chatId === currentChatId);
            
            if (currentChat && currentChat.title === "New Chat" && userMessagesInCurrentChatNow.length === 1) {
                const newTitle = generateChatTitle(userMessage.content);
                const updatedSessions = chatSessions.map(cs => 
                    cs.id === currentChatId ? { ...cs, title: newTitle, timestamp: Date.now() } : cs
                );
                setChatSessions(updatedSessions.sort((a,b) => b.timestamp - a.timestamp));
                await addChat({ id: currentChatId, title: newTitle, timestamp: Date.now() }); 
            }
        } catch (dbErr) {
            console.error("Failed to save user message or update title:", dbErr);
            setDbError("Failed to save your message. Please try again.");
            // Potentially roll back the optimistic UI update if DB save fails critically
            // setMessages(messages.filter(m => m.id !== userMessage.id));
        }
    }
  };

  const sidebarNewChatClick = async () => {
    await handleNewChat(true); // Always make active when user clicks new chat button
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */} 
      <AnimatePresence>
      {isSidebarOpen && (
        <motion.div 
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-64 md:w-72 lg:w-80 flex flex-col border-r bg-muted/40 h-full"
        >
          <div className="p-4 flex justify-between items-center border-b">
            <h2 className="text-xl font-semibold">Chat History</h2>
            <Button variant="ghost" size="icon" onClick={sidebarNewChatClick} title="New Chat">
              <PlusSquare className="h-5 w-5" />
            </Button>
          </div>
          {isDbLoading && chatSessions.length === 0 && (
            <div className="flex-grow flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <ScrollArea className="flex-grow">
            {chatSessions.length === 0 && !isDbLoading && (
                <div className="p-4 text-center text-muted-foreground">
                    <MessageSquare className="mx-auto h-10 w-10 mb-2" />
                    No chats yet. Start a new one!
                </div>
            )}
            {chatSessions.map(session => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 m-2 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors ${
                  activeChatId === session.id ? 'bg-primary/20 font-semibold' : ''
                }`}
                onClick={() => handleSelectChat(session.id)}
              >
                <div className="flex justify-between items-center">
                    <span className="truncate pr-2" title={session.title}>{session.title}</span>
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
          <div className="p-2 border-t mt-auto">
            <ThemeToggle />
          </div>

          <Button className="md:hidden m-2" onClick={() => setIsSidebarOpen(false)}>Close</Button>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Main Chat Area */} 
      <div className="flex flex-col flex-grow h-full">
        <header className="p-4 border-b shadow-sm flex items-center">
            {!isSidebarOpen && (
                <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={() => setIsSidebarOpen(true)}>
                    <MessageSquare className="h-5 w-5" /> { /* Or Menu icon */ }
                </Button>
            )}
          <h1 className="text-xl md:text-2xl font-semibold truncate">
            {activeChatId ? chatSessions.find(s => s.id === activeChatId)?.title : 'AI Chat'}
          </h1>
        </header>

        <ScrollArea className="flex-grow p-4 space-y-4" ref={scrollAreaRef}>
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
                      className="text-center p-8 bg-muted/30 rounded-lg shadow-sm"
                    >
                      <MessageSquare className="mx-auto h-12 w-12 mb-4 text-primary" />
                      <h2 className="text-2xl font-semibold mb-2">Welcome to AI Chat!</h2>
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
                  <h2 className="text-2xl font-semibold mb-2">Conversation Cleared or Empty</h2>
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
                className={`flex flex-col p-3 rounded-lg shadow-sm max-w-xl lg:max-w-2xl break-words whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground self-end ml-auto'
                    : 'bg-card text-card-foreground self-start mr-auto border'
                }`}
              >
                <span className="font-semibold capitalize pb-1">{m.role === 'user' ? 'You' : 'AI'}</span>
                {m.content}
                 {m.createdAt && <div className="text-xs opacity-60 pt-1 text-right">{new Date(m.createdAt).toLocaleTimeString()}</div>}
              </motion.div>
            ))}
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2 self-start mr-auto p-3 rounded-lg shadow-sm bg-muted text-muted-foreground max-w-xl lg:max-w-2xl border"
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
                className="text-red-600 p-3 rounded-lg bg-destructive/20 border border-destructive text-center my-4"
              >
                <p className="font-semibold">Error:</p>
                <p>{apiError?.message || dbError}</p>
                {apiError && <Button onClick={() => reload()} variant="outline" size="sm" className="mt-2">Retry API Request</Button>}
                {dbError && <Button onClick={loadChatSessions} variant="outline" size="sm" className="mt-2 ml-2">Retry DB Load</Button>}
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <footer className="p-4 border-t bg-background">
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
    </div>
  );
} 