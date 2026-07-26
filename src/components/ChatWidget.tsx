import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, ChevronLeft, Heart, Users, Circle, Video } from 'lucide-react';
import { useChat } from '@/contexts/useChat';
import { useAuth } from '@/contexts/useAuth';
import VideoCall from '@/components/VideoCall';

const ChatWidget = () => {
  const { user } = useAuth();
  const {
    threads,
    contacts,
    activeThread,
    messages,
    setActiveThread,
    sendMessage,
    totalUnread,
    currentCall,
    startVideoCall,
    dismissCurrentCall,
  } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentParticipant = contacts.find((contact) => contact.participantId === activeThread)
    ?? threads.find((thread) => thread.participantId === activeThread);
  
  const threadMessages = messages
    .filter((message) => {
      if (!activeThread || !user) return false;
      return (
        (message.senderId === user.id && message.receiverId === activeThread) ||
        (message.senderId === activeThread && message.receiverId === user.id)
      );
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, activeThread]);

  const handleSend = () => {
    if (!newMessage.trim() || !activeThread || !currentParticipant) return;
    sendMessage(activeThread, currentParticipant.participantName, newMessage);
    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user || !['patient', 'doctor'].includes(user.role)) return null;

  return (
    <>
      <AnimatePresence>
        {currentCall && (
          <VideoCall
            participantName={currentCall.participantName}
            participantRole={currentCall.participantRole}
            isIncoming={currentCall.direction === 'incoming' && currentCall.status === 'ringing'}
            onEnd={dismissCurrentCall}
          />
        )}
      </AnimatePresence>
      {/* Chat toggle button */}
      <button onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-primary text-primary-foreground shadow-lg hover:shadow-glow flex items-center justify-center transition-all hover:scale-105">
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {totalUnread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] h-[520px] bg-card rounded-2xl border border-border shadow-lg flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-14 px-4 flex items-center gap-3 border-b border-border bg-card shrink-0">
              {activeThread ? (
                <>
                  <button onClick={() => setActiveThread(null)} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    {currentParticipant?.participantRole === 'doctor' ? <Heart className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-card-foreground truncate">{currentParticipant?.participantName}</div>
                    <div className="flex items-center gap-1">
                      <Circle className="w-2 h-2 fill-success text-success" />
                      <span className="text-[11px] text-success">{currentParticipant?.subtitle || 'Secure messaging'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => currentParticipant && startVideoCall(
                      currentParticipant.participantId,
                      currentParticipant.participantName,
                      currentParticipant.participantRole,
                    )}
                    className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition"
                    title="Video call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <span className="text-sm font-display font-semibold text-card-foreground">Messages</span>
                </>
              )}
            </div>

            {/* Content */}
            {!activeThread ? (
              /* Thread list */
              <div className="flex-1 overflow-y-auto">
                {threads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-6 text-center">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm font-medium">No conversations yet</p>
                    <p className="text-xs mt-1">Open a contact to start secure messaging.</p>
                  </div>
                ) : (
                  threads.map(thread => (
                    <button key={thread.id} onClick={() => setActiveThread(thread.participantId)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition text-left border-b border-border last:border-0">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          {thread.participantRole === 'doctor' ? <Heart className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                        </div>
                        <Circle className="absolute -bottom-0.5 -right-0.5 w-3 h-3 fill-success text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-card-foreground">{thread.participantName}</span>
                          <span className="text-[10px] text-muted-foreground">{formatTime(thread.lastTimestamp)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-muted-foreground truncate pr-2">{thread.lastMessage}</span>
                          {thread.unreadCount > 0 && (
                            <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}

                {/* Quick start conversations */}
                {contacts.filter((contact) => !contact.hasConversation).length > 0 && (
                  <div className="p-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Start a conversation:</p>
                    {contacts.filter((contact) => !contact.hasConversation).slice(0, 4).map((contact) => (
                      <button key={contact.participantId}
                        onClick={() => {
                          setActiveThread(contact.participantId);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition text-left mb-1">
                        {contact.participantRole === 'doctor' ? <Heart className="w-4 h-4 text-primary" /> : <Users className="w-4 h-4 text-primary" />}
                        <div>
                          <div className="text-xs font-medium text-card-foreground">{contact.participantName}</div>
                          <div className="text-[10px] text-muted-foreground">{contact.subtitle || contact.participantRole}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Messages */
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {threadMessages.length === 0 && currentParticipant && (
                    <div className="h-full flex items-center justify-center text-center text-muted-foreground px-6">
                      <div>
                        <MessageSquare className="w-10 h-10 mb-3 mx-auto opacity-40" />
                        <p className="text-sm font-medium">No messages yet</p>
                        <p className="text-xs mt-1">Start the conversation with {currentParticipant.participantName}.</p>
                      </div>
                    </div>
                  )}
                  {threadMessages.map(msg => {
                    const isMe = msg.senderId === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          isMe
                            ? 'bg-gradient-primary text-primary-foreground rounded-br-md'
                            : 'bg-secondary text-secondary-foreground rounded-bl-md'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-border shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={currentParticipant ? `Message ${currentParticipant.participantName}...` : 'Type a message...'}
                      className="flex-1 h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button onClick={handleSend} disabled={!newMessage.trim()}
                      className="w-10 h-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition disabled:opacity-40">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;
