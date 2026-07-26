import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Maximize2, Minimize2, Monitor, MonitorOff, MessageSquare, Clock,
  Heart, Users, Send,
} from 'lucide-react';
import { useChat } from '@/contexts/useChat';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended';

interface VideoCallProps {
  participantName: string;
  participantRole: string;
  isIncoming?: boolean;
  onEnd: () => void;
}

interface ChatMsg {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VideoCall = ({
  participantName,
  participantRole,
  isIncoming = false,
  onEnd,
}: VideoCallProps) => {
  const {
    currentCall,
    callSignals,
    acceptCurrentCall,
    declineCurrentCall,
    endCurrentCall,
    sendCallSignal,
    consumeCallSignal,
  } = useChat();
  const [callState, setCallState] = useState<CallState>(isIncoming ? 'ringing' : 'connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const stopTracks = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const teardownPeer = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    stopTracks(localStreamRef.current);
    stopTracks(screenStreamRef.current);
    localStreamRef.current = null;
    screenStreamRef.current = null;
    remoteStreamRef.current = null;
    setRemoteVideoActive(false);
  }, [stopTracks]);

  const ensurePeerConnection = useCallback(async () => {
    if (!currentCall) return null;
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = peerConnection;

    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = localStream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }

    peerConnection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
      setRemoteVideoActive(true);
      setCallState('active');
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal('ice-candidate', event.candidate.toJSON());
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        setCallState('active');
      }
      if (['failed', 'disconnected', 'closed'].includes(peerConnection.connectionState)) {
        setCallState('ended');
      }
    };

    return peerConnection;
  }, [currentCall, sendCallSignal]);

  const createOffer = useCallback(async () => {
    const peerConnection = await ensurePeerConnection();
    if (!peerConnection) return;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendCallSignal('offer', offer);
    setCallState('connecting');
  }, [ensurePeerConnection, sendCallSignal]);

  const handleIncomingSignal = useCallback(async (signal: typeof callSignals[number]) => {
    try {
      if (signal.signalType === 'call-accepted') {
        if (currentCall?.direction === 'outgoing') {
          await createOffer();
        }
        consumeCallSignal(signal.id);
        return;
      }

      if (signal.signalType === 'call-declined' || signal.signalType === 'call-ended') {
        setCallState('ended');
        teardownPeer();
        consumeCallSignal(signal.id);
        window.setTimeout(onEnd, 800);
        return;
      }

      const peerConnection = await ensurePeerConnection();
      if (!peerConnection) return;

      if (signal.signalType === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendCallSignal('answer', answer);
        setCallState('connecting');
      }

      if (signal.signalType === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
        setCallState('active');
      }

      if (signal.signalType === 'ice-candidate' && signal.payload) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
      }
    } catch (error) {
      console.error('Failed to process call signal:', error);
    } finally {
      consumeCallSignal(signal.id);
    }
  }, [consumeCallSignal, createOffer, currentCall?.direction, ensurePeerConnection, onEnd, sendCallSignal, teardownPeer]);

  useEffect(() => {
    setCallState(isIncoming ? 'ringing' : 'connecting');
  }, [isIncoming]);

  useEffect(() => {
    if (!currentCall) {
      teardownPeer();
      setCallState('ended');
      return;
    }
  }, [currentCall, teardownPeer]);

  useEffect(() => {
    callSignals
      .filter((signal) => currentCall && signal.callId === currentCall.id)
      .forEach((signal) => {
        void handleIncomingSignal(signal);
      });
  }, [callSignals, currentCall, handleIncomingSignal]);

  useEffect(() => {
    if (!isIncoming && currentCall?.direction === 'outgoing') {
      setCallState(currentCall.status === 'ringing' ? 'ringing' : 'connecting');
    }
  }, [currentCall?.direction, currentCall?.status, isIncoming]);

  useEffect(() => {
    if (callState === 'active') {
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    teardownPeer();
  }, [teardownPeer]);

  const handleAccept = async () => {
    await ensurePeerConnection();
    acceptCurrentCall();
    setCallState('connecting');
  };

  const handleEnd = () => {
    setCallState('ended');
    endCurrentCall();
    teardownPeer();
    clearInterval(timerRef.current);
    window.setTimeout(onEnd, 800);
  };

  const handleDecline = () => {
    declineCurrentCall();
    teardownPeer();
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setIsMuted((value) => !value);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setIsVideoOn((value) => !value);
  };

  const startScreenShare = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
      }
      setIsScreenSharing(true);

      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find((candidate) => candidate.track?.kind === 'video');
      await sender?.replaceTrack(screenTrack);

      screenTrack.onended = async () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        await sender?.replaceTrack(cameraTrack ?? null);
        setIsScreenSharing(false);
        stopTracks(screenStreamRef.current);
        screenStreamRef.current = null;
      };
    } catch (error) {
      console.error('Screen sharing unavailable:', error);
    }
  }, [stopTracks]);

  const stopScreenShare = useCallback(async () => {
    const sender = peerConnectionRef.current?.getSenders().find((candidate) => candidate.track?.kind === 'video');
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    await sender?.replaceTrack(cameraTrack ?? null);
    stopTracks(screenStreamRef.current);
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  }, [stopTracks]);

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      void stopScreenShare();
      return;
    }
    void startScreenShare();
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen((value) => !value);
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages((current) => [...current, {
      id: crypto.randomUUID(),
      text: chatInput,
      isMe: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setChatInput('');
  };

  const formatElapsed = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center"
    >
      <div className={`relative w-full h-full max-w-6xl max-h-[90vh] mx-auto flex flex-col ${isFullscreen ? 'max-w-none max-h-none' : 'p-4'}`}>
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-gradient-to-br from-muted to-secondary">
          {isScreenSharing && callState === 'active' && (
            <div className="absolute inset-0 bg-background">
              <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/90 text-primary-foreground text-sm font-medium shadow-lg">
                <Monitor className="w-4 h-4" />
                Sharing your screen
              </div>
            </div>
          )}

          {callState === 'active' && remoteVideoActive && !isScreenSharing ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {callState === 'active' ? (
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 ring-4 ring-primary/20">
                    {participantRole === 'doctor' ? <Heart className="w-16 h-16" /> : <Users className="w-16 h-16" />}
                  </div>
                  <p className="text-xl font-display font-semibold text-foreground">{participantName}</p>
                  <p className="text-sm text-muted-foreground mt-1 capitalize">{participantRole}</p>
                  <div className="flex items-center gap-1.5 justify-center mt-2 text-success">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-sm font-mono">{formatElapsed(elapsed)}</span>
                  </div>
                </div>
              ) : callState === 'ringing' ? (
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-28 h-28 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 ring-4 ring-primary/20"
                  >
                    {participantRole === 'doctor' ? <Heart className="w-14 h-14" /> : <Users className="w-14 h-14" />}
                  </motion.div>
                  <p className="text-xl font-display font-semibold text-foreground">{participantName}</p>
                  <motion.p
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-sm text-primary mt-2"
                  >
                    {isIncoming ? 'Incoming video call...' : 'Calling...'}
                  </motion.p>
                </div>
              ) : callState === 'connecting' ? (
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent mx-auto mb-4"
                  />
                  <p className="text-foreground font-medium">Connecting to {participantName}...</p>
                </div>
              ) : (
                <div className="text-center">
                  <PhoneOff className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium">Call ended</p>
                  <p className="text-sm text-muted-foreground mt-1">Duration: {formatElapsed(elapsed)}</p>
                </div>
              )}
            </div>
          )}

          {['connecting', 'active'].includes(callState) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`absolute bottom-4 right-4 rounded-xl overflow-hidden border-2 border-border shadow-lg bg-muted ${
                isScreenSharing ? 'w-36 h-28' : 'w-48 h-36'
              }`}
            >
              {isVideoOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-secondary">
                  <VideoOff className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-background/70 text-foreground text-[10px] font-medium">
                You
              </div>
            </motion.div>
          )}

          {callState === 'active' && !isScreenSharing && (
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/70 text-foreground text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Connected via WebRTC
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          {callState === 'ringing' && isIncoming ? (
            <>
              <button onClick={handleDecline} className="w-14 h-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90 transition shadow-lg">
                <PhoneOff className="w-6 h-6" />
              </button>
              <button onClick={() => void handleAccept()} className="w-14 h-14 rounded-full bg-success text-primary-foreground flex items-center justify-center hover:opacity-90 transition shadow-lg">
                <Phone className="w-6 h-6" />
              </button>
            </>
          ) : callState === 'active' || callState === 'connecting' || callState === 'ringing' ? (
            <>
              {callState === 'active' && (
                <>
                  <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-md ${
                    isMuted ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}>
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-md ${
                    !isVideoOn ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}>
                    {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <button onClick={toggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-md ${
                    isScreenSharing ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}>
                    {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setShowChat((value) => !value)} className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-md ${
                    showChat ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}>
                    <MessageSquare className="w-5 h-5" />
                  </button>
                  <button onClick={toggleFullscreen} className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition shadow-md">
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
                </>
              )}
              <button onClick={handleEnd} className="w-14 h-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90 transition shadow-lg">
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          ) : null}
        </div>

        <AnimatePresence>
          {showChat && callState === 'active' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 bottom-20 w-72 bg-card rounded-2xl border border-border shadow-lg flex flex-col overflow-hidden"
            >
              <div className="h-12 px-4 flex items-center border-b border-border">
                <span className="text-sm font-medium text-card-foreground">In-call chat</span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-2">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center mt-8">Send quick messages during the call</p>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
                        message.isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}>
                        <p>{message.text}</p>
                        <p className={`text-[9px] mt-1 ${message.isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{message.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button onClick={sendChatMessage} disabled={!chatInput.trim()} className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition disabled:opacity-40">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default VideoCall;
