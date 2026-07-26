import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Heart, Users, Circle, Search, Video, Terminal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '@/contexts/useChat';
import { useAuth } from '@/contexts/useAuth';
import VideoCall from '@/components/VideoCall';

const MessagesPage = () => {
  const { user } = useAuth();
  const { threads, contacts, messages, setActiveThread, sendMessage } = useChat();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newMessage, setNewMessage] = useState('');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [videoCallTarget, setVideoCallTarget] = useState<{ name: string; role: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const availableParticipantIds = useMemo(
    () => new Set(contacts.map((contact) => contact.participantId)),
    [contacts],
  );

  const currentParticipant = contacts.find((contact) => contact.participantId === selectedThread)
    ?? threads.find((thread) => thread.participantId === selectedThread);
  const focusThread = searchParams.get('thread');

  const threadMessages = messages
    .filter((message) => {
      if (!selectedThread || !user) return false;
      return (
        (message.senderId === user.id && message.receiverId === selectedThread) ||
        (message.senderId === selectedThread && message.receiverId === user.id)
      );
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, selectedThread]);

  useEffect(() => {
    if (focusThread && availableParticipantIds.has(focusThread)) {
      setSelectedThread(focusThread);
      setActiveThread(focusThread);
      return;
    }

    if (focusThread) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('thread');
        return next;
      }, { replace: true });
    }
  }, [availableParticipantIds, focusThread, setActiveThread, setSearchParams]);

  useEffect(() => {
    if (selectedThread && availableParticipantIds.has(selectedThread)) return;
    const defaultThread = threads[0]?.participantId ?? contacts[0]?.participantId ?? null;
    if (!defaultThread) return;
    setSelectedThread(defaultThread);
    setActiveThread(defaultThread);
  }, [availableParticipantIds, contacts, selectedThread, setActiveThread, threads]);

  const handleSend = () => {
    if (!newMessage.trim() || !selectedThread || !currentParticipant) return;
    sendMessage(selectedThread, currentParticipant.participantName, newMessage);
    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (date: Date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  const filteredContacts = contacts.filter((contact) =>
    contact.participantName.toLowerCase().includes(search.toLowerCase()),
  );
  const conversationContacts = filteredContacts.filter((contact) => contact.hasConversation);
  const newContacts = filteredContacts.filter((contact) => !contact.hasConversation);

  return (
    <div className="h-[calc(100vh-7rem)] font-mono text-[#ECEEF2]">
      <AnimatePresence>
        {videoCallTarget && (
          <VideoCall
            participantName={videoCallTarget.name}
            participantRole={videoCallTarget.role}
            onEnd={() => setVideoCallTarget(null)}
          />
        )}
      </AnimatePresence>
      <div className="flex h-full bg-[#090D14] border border-[#252A35] rounded-[4px] overflow-hidden">
        {/* Sidebar — Contact Threads */}
        <div className="w-72 border-r border-[#252A35] flex flex-col shrink-0">
          <div className="p-3 border-b border-[#252A35] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Secure Channel Directory</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter channels..."
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] pl-8 pr-3 py-1.5 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversationContacts.map((contact) => {
              const thread = threads.find((candidate) => candidate.participantId === contact.participantId);
              if (!thread) return null;

              return (
                <button
                  key={thread.id}
                  onClick={() => { setSelectedThread(thread.participantId); setActiveThread(thread.participantId); }}
                  className={`w-full flex items-center gap-2.5 p-3 text-left transition border-b border-[#1F232E] text-xs ${
                    selectedThread === thread.participantId ? 'bg-[#151922] border-l-2 border-l-cyan-500' : 'hover:bg-[#0F1218]'
                  }`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-[2px] bg-[#151922] border border-[#2F3542] text-cyan-400 flex items-center justify-center">
                      {thread.participantRole === 'doctor' ? <Heart className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#090D14]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#ECEEF2] truncate">{thread.participantName}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{formatTime(thread.lastTimestamp)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-slate-500 truncate pr-2">{thread.lastMessage}</span>
                      {thread.unreadCount > 0 && (
                        <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-[2px] bg-cyan-500 text-[#06080C] text-[9px] font-bold flex items-center justify-center">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {newContacts.length > 0 && (
              <div className="p-3 border-t border-[#252A35]">
                <p className="text-[10px] text-slate-500 mb-2 font-bold uppercase">New Channel Targets</p>
                {newContacts.map(contact => (
                  <button key={contact.participantId} onClick={() => {
                    setSelectedThread(contact.participantId);
                    setActiveThread(contact.participantId);
                  }}
                    className="w-full flex items-center gap-2 p-2 rounded-[2px] hover:bg-[#0F1218] transition text-left mb-1 text-xs">
                    <div className="w-7 h-7 rounded-[2px] bg-[#151922] border border-[#2F3542] text-slate-400 flex items-center justify-center">
                      {contact.participantRole === 'doctor' ? <Heart className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    </div>
                    <div>
                      <div className="font-bold text-[#ECEEF2]">{contact.participantName}</div>
                      <div className="text-[9px] text-slate-500">{contact.subtitle || contact.participantRole}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedThread && currentParticipant ? (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="h-12 px-4 flex items-center gap-3 border-b border-[#252A35] shrink-0 bg-[#0F1218]">
              <div className="w-7 h-7 rounded-[2px] bg-[#151922] border border-[#2F3542] text-cyan-400 flex items-center justify-center">
                {currentParticipant.participantRole === 'doctor' ? <Heart className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-[#ECEEF2]">{currentParticipant.participantName}</div>
                <div className="text-[9px] text-emerald-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>SECURE CHANNEL ACTIVE</span>
                </div>
              </div>
              <button
                onClick={() => setVideoCallTarget({ name: currentParticipant.participantName, role: currentParticipant.participantRole })}
                className="p-1.5 bg-[#151922] border border-[#2F3542] rounded-[2px] text-cyan-400 hover:bg-cyan-950 transition"
                title="Start video call"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadMessages.length === 0 && (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <Terminal className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs text-slate-500">No messages in this secure channel.</p>
                    <p className="text-[10px] text-slate-600 mt-1">Initiate communication with {currentParticipant.participantName}.</p>
                  </div>
                </div>
              )}
              {threadMessages.map((msg, i) => {
                const isMe = msg.senderId === user?.id;
                const showDate = i === 0 || formatDate(msg.timestamp) !== formatDate(threadMessages[i - 1].timestamp);
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="text-center my-3">
                        <span className="px-2 py-0.5 bg-[#151922] border border-[#252A35] rounded-[2px] text-[9px] text-slate-500 font-mono">{formatDate(msg.timestamp)}</span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[65%] px-3 py-2 text-xs ${
                        isMe
                          ? 'bg-cyan-950/60 border border-cyan-600/40 text-cyan-100 rounded-[4px] rounded-br-[1px]'
                          : 'bg-[#151922] border border-[#2F3542] text-slate-200 rounded-[4px] rounded-bl-[1px]'
                      }`}>
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={`text-[9px] mt-1 ${isMe ? 'text-cyan-400/50' : 'text-slate-600'}`}>
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[#252A35] shrink-0 bg-[#0F1218]">
              <div className="flex items-center gap-2">
                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Transmit to ${currentParticipant.participantName}...`}
                  className="flex-1 bg-[#090D14] border border-[#252A35] rounded-[2px] px-3 py-2 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <button onClick={handleSend} disabled={!newMessage.trim()}
                  className="p-2 bg-cyan-950 border border-cyan-600/60 text-cyan-300 rounded-[2px] hover:bg-cyan-900 transition disabled:opacity-30">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Terminal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Select a secure channel to begin transmission.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
