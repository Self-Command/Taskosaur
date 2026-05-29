import { createContext, useContext, useState, ReactNode } from "react";

interface ChatContextType {
  isChatOpen: boolean;
  toggleChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    return { isChatOpen: false, toggleChat: () => {} };
  }
  return context;
};

export function ChatProvider({ children }: ChatProviderProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const toggleChat = () => setIsChatOpen((prev) => !prev);
  return <ChatContext.Provider value={{ isChatOpen, toggleChat }}>{children}</ChatContext.Provider>;
}

interface ChatProviderProps { children: ReactNode; }
export default ChatProvider;
