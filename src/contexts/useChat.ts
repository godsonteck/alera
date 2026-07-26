import { useContext } from 'react';
import { ChatContext } from './chat-context';

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be within ChatProvider');
  return ctx;
};
