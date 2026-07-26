import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useNotifications } from './useNotifications';
import { ChatContext, type CallSession, type CallSignalEvent } from './chat-context';
import { messagingApi } from '@/lib/apiService';
import { normalizeUserRole } from '@/lib/roleUtils';
import { getTelemedicineSocketUrl } from '@/lib/telemedicineSocket';
import type { UserRole } from './AuthContext';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface ChatThread {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  participantEmail?: string;
  subtitle?: string;
  lastMessage: string;
  lastTimestamp: Date;
  unreadCount: number;
}

export interface ChatContact {
  participantId: string;
  participantName: string;
  participantRole: string;
  participantEmail?: string;
  subtitle?: string;
  hasConversation: boolean;
  lastTimestamp?: Date;
}

type BackendMessage = {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  subject?: string | null;
  is_read: string;
  is_archived: string;
  created_at: string;
  read_at?: string | null;
  sender?: { id: number; name: string; email?: string | null; role?: string | null };
  recipient?: { id: number; name: string; email?: string | null; role?: string | null };
};

type SocketEnvelope =
  | { type: 'telemedicine.ready'; user_id: number; role: string }
  | { type: 'chat_message'; message: BackendMessage }
  | { type: 'incoming_call' | 'call_invite_sent'; call: { id: number; participant_id: number; participant_name: string; participant_role: string; status: string } }
  | { type: 'call_accepted' | 'call_declined' | 'call_ended'; call_id: number; sender_id: number }
  | { type: 'webrtc_signal'; call_id: number; sender_id: number; signal_type: 'offer' | 'answer' | 'ice-candidate'; payload?: unknown }
  | { type: 'error'; detail: string }
  | { type: 'pong' };

const sortByTimestamp = (items: ChatMessage[]) => [...items].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

const isMessageRead = (value: string) => value === 'Y' || value === 'y' || value === 'true';

const roleSubtitleMap: Record<UserRole, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  hospital: 'Hospital team',
  laboratory: 'Laboratory team',
  imaging: 'Imaging center',
  pharmacy: 'Pharmacy team',
  ambulance: 'Ambulance team',
  admin: 'Admin',
  super_admin: 'Super admin',
};

const isOperationalRole = (role?: string): role is UserRole => {
  const normalized = normalizeUserRole(role);
  return Boolean(
    normalized &&
    !['admin', 'super_admin'].includes(normalized),
  );
};

const getContactSubtitle = (role?: string, hasConversation: boolean = false) => {
  const normalized = normalizeUserRole(role);
  if (!normalized) return hasConversation ? 'Recent conversation' : 'Secure conversation';
  if (hasConversation) return `Recent conversation with ${roleSubtitleMap[normalized]}`;
  return roleSubtitleMap[normalized];
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, getUsers } = useAuth();
  const { addNotification } = useNotifications();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeThread, setActiveThreadState] = useState<string | null>(null);
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [callSignals, setCallSignals] = useState<CallSignalEvent[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const getUserSummary = useCallback((userId: string) => {
    const match = getUsers().find((account) => account.id === userId);
    return {
      name: match?.name ?? `User ${userId}`,
      email: match?.email,
      role: match?.role ?? 'patient',
    };
  }, [getUsers]);

  const mapBackendMessage = useCallback((item: BackendMessage): ChatMessage => {
    const sender = getUserSummary(String(item.sender_id));
    const recipient = getUserSummary(String(item.recipient_id));

    return {
      id: String(item.id),
      senderId: String(item.sender_id),
      senderName: item.sender?.name ?? sender.name,
      senderRole: normalizeUserRole(item.sender?.role) ?? sender.role,
      receiverId: String(item.recipient_id),
      receiverName: item.recipient?.name ?? recipient.name,
      content: item.content,
      timestamp: new Date(item.created_at),
      read: isMessageRead(item.is_read),
    };
  }, [getUserSummary]);

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => {
      const merged = new Map(current.map((message) => [message.id, message]));
      incoming.forEach((message) => merged.set(message.id, message));
      return sortByTimestamp(Array.from(merged.values()));
    });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!user) {
      setMessages([]);
      setActiveThreadState(null);
      return [];
    }

    try {
      const response = await messagingApi.listMessages(0, 200);
      const mapped = (Array.isArray(response) ? response : []).map((item) => mapBackendMessage(item as BackendMessage));
      setMessages(sortByTimestamp(mapped));
      return mapped;
    } catch (error) {
      console.error('Failed to load chat messages:', error);
      setMessages([]);
      return [];
    }
  }, [mapBackendMessage, user]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const markThreadRead = useCallback(async (participantId: string) => {
    if (!user) return;

    const unreadMessages = messages.filter(
      (message) => message.receiverId === user.id && message.senderId === participantId && !message.read,
    );
    if (unreadMessages.length === 0) return;

    setMessages((current) => current.map((message) => (
      unreadMessages.some((candidate) => candidate.id === message.id)
        ? { ...message, read: true }
        : message
    )));

    try {
      await Promise.all(unreadMessages.map((message) => messagingApi.updateMessage(message.id, { is_read: 'Y' })));
    } catch (error) {
      console.error('Failed to mark thread read:', error);
      void loadMessages();
    }
  }, [loadMessages, messages, user]);

  const setActiveThread = useCallback((id: string | null) => {
    setActiveThreadState(id);
    if (id) {
      void markThreadRead(id);
    }
  }, [markThreadRead]);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setCurrentCall(null);
      setCallSignals([]);
      return;
    }

    let isClosedIntentional = false;

    const connect = () => {
      const socket = new WebSocket(getTelemedicineSocketUrl());
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as SocketEnvelope;

        if (payload.type === 'chat_message') {
          const mapped = mapBackendMessage(payload.message);
          mergeMessages([mapped]);

          if (mapped.senderId !== user.id) {
            addNotification({
              title: mapped.senderName,
              message: mapped.content,
              type: 'chat',
              audience: 'personal',
              actionUrl: '/dashboard/messages',
              actionLabel: 'Open message',
            });
          }

          if (activeThread === mapped.senderId || activeThread === mapped.receiverId) {
            void markThreadRead(mapped.senderId === user.id ? mapped.receiverId : mapped.senderId);
          }
          return;
        }

        if (payload.type === 'incoming_call') {
          setCurrentCall({
            id: String(payload.call.id),
            participantId: String(payload.call.participant_id),
            participantName: payload.call.participant_name,
            participantRole: normalizeUserRole(payload.call.participant_role) ?? payload.call.participant_role,
            direction: 'incoming',
            status: 'ringing',
          });
          return;
        }

        if (payload.type === 'call_invite_sent') {
          setCurrentCall({
            id: String(payload.call.id),
            participantId: String(payload.call.participant_id),
            participantName: payload.call.participant_name,
            participantRole: normalizeUserRole(payload.call.participant_role) ?? payload.call.participant_role,
            direction: 'outgoing',
            status: 'ringing',
          });
          return;
        }

        if (payload.type === 'call_accepted' || payload.type === 'call_declined' || payload.type === 'call_ended') {
          const signalType = payload.type === 'call_accepted'
            ? 'call-accepted'
            : payload.type === 'call_declined'
              ? 'call-declined'
              : 'call-ended';

          setCallSignals((current) => [...current, {
            id: crypto.randomUUID(),
            callId: String(payload.call_id),
            senderId: String(payload.sender_id),
            signalType,
          }]);

          if (payload.type === 'call_accepted') {
            setCurrentCall((current) => current && current.id === String(payload.call_id)
              ? { ...current, status: 'connecting' }
              : current);
          } else {
            setCurrentCall((current) => current && current.id === String(payload.call_id)
              ? { ...current, status: 'ended' }
              : current);
          }
          return;
        }

        if (payload.type === 'webrtc_signal') {
          setCallSignals((current) => [...current, {
            id: crypto.randomUUID(),
            callId: String(payload.call_id),
            senderId: String(payload.sender_id),
            signalType: payload.signal_type,
            payload: payload.payload,
          }]);
          return;
        }

        if (payload.type === 'error') {
          console.error('Telemedicine socket error:', payload.detail);
        }
      };

      socket.onclose = () => {
        if (isClosedIntentional) return;
        reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      isClosedIntentional = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [activeThread, addNotification, mapBackendMessage, markThreadRead, mergeMessages, user]);

  const sendSocketMessage = useCallback((payload: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const sendMessage = useCallback(async (receiverId: string, receiverName: string, content: string) => {
    if (!user || !content.trim()) return;

    const sentOverSocket = sendSocketMessage({
      type: 'chat_message',
      recipient_id: Number(receiverId),
      subject: 'Secure message',
      content,
    });

    if (!sentOverSocket) {
      try {
        await messagingApi.sendMessage({
          recipient_id: receiverId,
          subject: 'Secure message',
          content,
        });
        await loadMessages();
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    }

    addNotification({
      title: `New message from ${user.name}`,
      message: content,
      type: 'chat',
      audience: 'personal',
      actionUrl: '/dashboard/messages',
      actionLabel: `Open ${receiverName}`,
    });
  }, [addNotification, loadMessages, sendSocketMessage, user]);

  const startVideoCall = useCallback((participantId: string, participantName: string, participantRole: string) => {
    const sent = sendSocketMessage({
      type: 'call_invite',
      recipient_id: Number(participantId),
    });

    if (!sent) {
      setCurrentCall({
        id: crypto.randomUUID(),
        participantId,
        participantName,
        participantRole,
        direction: 'outgoing',
        status: 'connecting',
      });
    }
  }, [sendSocketMessage]);

  const acceptCurrentCall = useCallback(() => {
    if (!currentCall) return;
    setCurrentCall((current) => current ? { ...current, status: 'connecting' } : current);
    sendSocketMessage({
      type: 'call_response',
      call_id: Number(currentCall.id),
      response: 'accepted',
    });
  }, [currentCall, sendSocketMessage]);

  const declineCurrentCall = useCallback(() => {
    if (!currentCall) return;
    sendSocketMessage({
      type: 'call_response',
      call_id: Number(currentCall.id),
      response: 'declined',
    });
    setCurrentCall(null);
    setCallSignals([]);
  }, [currentCall, sendSocketMessage]);

  const endCurrentCall = useCallback(() => {
    if (!currentCall) return;
    sendSocketMessage({
      type: 'call_end',
      call_id: Number(currentCall.id),
    });
    setCurrentCall(null);
    setCallSignals([]);
  }, [currentCall, sendSocketMessage]);

  const dismissCurrentCall = useCallback(() => {
    setCurrentCall(null);
    setCallSignals([]);
  }, []);

  const sendCallSignal = useCallback((signalType: CallSignalEvent['signalType'], payload?: unknown) => {
    if (!currentCall || !['offer', 'answer', 'ice-candidate'].includes(signalType)) {
      return;
    }

    sendSocketMessage({
      type: 'webrtc_signal',
      call_id: Number(currentCall.id),
      recipient_id: Number(currentCall.participantId),
      signal_type: signalType,
      payload,
    });
  }, [currentCall, sendSocketMessage]);

  const consumeCallSignal = useCallback((signalId: string) => {
    setCallSignals((current) => current.filter((signal) => signal.id !== signalId));
  }, []);

  const threads = useMemo<ChatThread[]>(() => {
    if (!user) return [];

    const relevant = sortByTimestamp(messages.filter((message) => message.senderId === user.id || message.receiverId === user.id));
    const threadMap = new Map<string, ChatThread>();
    const usersById = new Map(getUsers().map((account) => [account.id, account]));

    relevant.forEach((message) => {
      const isOutgoing = message.senderId === user.id;
      const participantId = isOutgoing ? message.receiverId : message.senderId;
      const participant = usersById.get(participantId);
      const participantName = isOutgoing ? message.receiverName : message.senderName;
      const participantRole = participant?.role ?? message.senderRole;
      const participantEmail = participant?.email;

      threadMap.set(participantId, {
        id: participantId,
        participantId,
        participantName,
        participantRole,
        participantEmail,
        subtitle: getContactSubtitle(participantRole, true),
        lastMessage: message.content,
        lastTimestamp: message.timestamp,
        unreadCount: relevant.filter((candidate) => (
          candidate.senderId === participantId &&
          candidate.receiverId === user.id &&
          !candidate.read
        )).length,
      });
    });

    return Array.from(threadMap.values()).sort((a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime());
  }, [getUsers, messages, user]);

  const contacts = useMemo<ChatContact[]>(() => {
    if (!user) return [];

    const contactMap = new Map<string, ChatContact>();
    const allUsers = getUsers();

    threads.forEach((thread) => {
      contactMap.set(thread.participantId, {
        participantId: thread.participantId,
        participantName: thread.participantName,
        participantRole: thread.participantRole,
        participantEmail: thread.participantEmail,
        subtitle: thread.participantRole === 'doctor' ? 'Recent conversation' : 'Patient conversation',
        hasConversation: true,
        lastTimestamp: thread.lastTimestamp,
      });
    });

    const userRole = normalizeUserRole(user.role);
    const availableContacts = allUsers.filter((account) => {
      if (account.id === user.id) return false;

      const accountRole = normalizeUserRole(account.role);
      if (!isOperationalRole(accountRole)) return false;

      if (userRole === 'patient') {
        return accountRole !== 'patient';
      }

      if (!userRole || !isOperationalRole(userRole)) {
        return false;
      }

      return true;
    });

    availableContacts.forEach((account) => {
      const existing = contactMap.get(account.id);
      contactMap.set(account.id, {
        participantId: account.id,
        participantName: account.name,
        participantRole: account.role,
        participantEmail: account.email,
        subtitle: existing?.subtitle ?? account.profile?.bio?.trim() ?? getContactSubtitle(account.role),
        hasConversation: existing?.hasConversation ?? false,
        lastTimestamp: existing?.lastTimestamp,
      });
    });

    return Array.from(contactMap.values()).sort((a, b) => {
      if (a.hasConversation !== b.hasConversation) {
        return a.hasConversation ? -1 : 1;
      }
      if (a.lastTimestamp && b.lastTimestamp) {
        return b.lastTimestamp.getTime() - a.lastTimestamp.getTime();
      }
      return a.participantName.localeCompare(b.participantName);
    });
  }, [getUsers, threads, user]);

  useEffect(() => {
    if (activeThread && !contacts.some((contact) => contact.participantId === activeThread)) {
      setActiveThreadState(null);
    }
  }, [activeThread, contacts]);

  const totalUnread = useMemo(
    () => messages.filter((message) => message.receiverId === user?.id && !message.read).length,
    [messages, user?.id],
  );

  const contextValue = useMemo(() => ({
    threads,
    contacts,
    activeThread,
    messages,
    setActiveThread,
    sendMessage,
    totalUnread,
    currentCall,
    callSignals,
    startVideoCall,
    acceptCurrentCall,
    declineCurrentCall,
    endCurrentCall,
    dismissCurrentCall,
    sendCallSignal,
    consumeCallSignal,
  }), [
    acceptCurrentCall,
    activeThread,
    callSignals,
    consumeCallSignal,
    contacts,
    currentCall,
    dismissCurrentCall,
    declineCurrentCall,
    endCurrentCall,
    messages,
    sendCallSignal,
    sendMessage,
    setActiveThread,
    startVideoCall,
    threads,
    totalUnread,
  ]);

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};
