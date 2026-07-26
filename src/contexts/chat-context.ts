import { createContext } from 'react';
import type { ChatContact, ChatMessage, ChatThread } from './ChatContext';

export interface CallSession {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  direction: 'incoming' | 'outgoing';
  status: 'ringing' | 'connecting' | 'active' | 'ended';
}

export interface CallSignalEvent {
  id: string;
  callId: string;
  senderId: string;
  signalType: 'offer' | 'answer' | 'ice-candidate' | 'call-accepted' | 'call-declined' | 'call-ended';
  payload?: unknown;
}

export interface ChatContextType {
  threads: ChatThread[];
  contacts: ChatContact[];
  activeThread: string | null;
  messages: ChatMessage[];
  setActiveThread: (id: string | null) => void;
  sendMessage: (receiverId: string, receiverName: string, content: string) => void;
  totalUnread: number;
  currentCall: CallSession | null;
  callSignals: CallSignalEvent[];
  startVideoCall: (participantId: string, participantName: string, participantRole: string) => void;
  acceptCurrentCall: () => void;
  declineCurrentCall: () => void;
  endCurrentCall: () => void;
  dismissCurrentCall: () => void;
  sendCallSignal: (signalType: CallSignalEvent['signalType'], payload?: unknown) => void;
  consumeCallSignal: (signalId: string) => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);
