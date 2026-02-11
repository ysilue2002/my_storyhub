import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import LanguageSwitcher from './components/LanguageSwitcher';
import Footer from './components/Footer';
import Header from './components/Header';
import AuthCard from './components/AuthCard';
import SearchBar from './components/SearchBar';

import fr from './lang/fr.json';
import en from './lang/en.json';
import ar from './lang/ar.json';

const messages = { fr, en, ar };
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
const WS_BASE = process.env.REACT_APP_WS_BASE || API_BASE;

export default function Messages() {
  const [lang, setLang] = useState('fr');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authState, setAuthState] = useState({ loading: false, error: '' });
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messagesList, setMessagesList] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [box, setBox] = useState('inbox');
  const [alerts, setAlerts] = useState({ pendingRequests: 0, unreadMessages: 0 });
  const socketRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [callState, setCallState] = useState({ active: false, type: null, status: '' });
  const [incomingCall, setIncomingCall] = useState(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);

  const t = messages[lang];

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const authFetch = (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return fetch(url, { ...options, headers });
  };

  const loadAlerts = async () => {
    if (!authToken) {
      setAlerts({ pendingRequests: 0, unreadMessages: 0 });
      return;
    }
    try {
      const response = await authFetch(`${API_BASE}/api/alerts-summary`);
      const data = await response.json();
      setAlerts({
        pendingRequests: Number(data.pendingRequests) || 0,
        unreadMessages: Number(data.unreadMessages) || 0,
      });
    } catch (error) {
      setAlerts({ pendingRequests: 0, unreadMessages: 0 });
    }
  };

  const loadMe = async () => {
    if (!authToken) {
      setCurrentUser(null);
      return;
    }
    try {
      const response = await authFetch(`${API_BASE}/api/me`);
      if (!response.ok) throw new Error('Auth failed');
      const data = await response.json();
      setCurrentUser(data);
    } catch (error) {
      setCurrentUser(null);
      setAuthToken('');
      localStorage.removeItem('authToken');
    }
  };

  const loadThreads = async () => {
    if (!authToken) {
      setThreads([]);
      return;
    }
    try {
      const response = await authFetch(`${API_BASE}/api/messages/threads?box=${box}`);
      const data = await response.json();
      setThreads(Array.isArray(data) ? data : []);
    } catch (error) {
      setThreads([]);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!authToken || !conversationId) {
      setMessagesList([]);
      return;
    }
    try {
      const response = await authFetch(`${API_BASE}/api/messages?conversationId=${conversationId}`);
      const data = await response.json();
      setMessagesList(Array.isArray(data) ? data : []);
      loadAlerts();
      loadThreads();
    } catch (error) {
      setMessagesList([]);
    }
  };

  useEffect(() => {
    loadMe();
    loadThreads();
    loadAlerts();
  }, [authToken, box]);

  useEffect(() => {
    if (callState.active) {
      endCall(false);
    }
    setIncomingCall(null);
  }, [selectedThread]);

  useEffect(() => {
    if (!authToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }
    const socket = io(WS_BASE, { auth: { token: authToken } });
    socketRef.current = socket;

    socket.on('message:new', (message) => {
      if (selectedThread && message.conversationId === selectedThread.id) {
        setMessagesList((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
      }
      loadThreads();
      loadAlerts();
    });

    socket.on('webrtc:offer', async ({ conversationId, offer, fromUserId }) => {
      if (!selectedThread || selectedThread.id !== conversationId) return;
      const hasVideo = Boolean(offer?.sdp && offer.sdp.includes('m=video'));
      setIncomingCall({
        conversationId,
        fromUserId,
        offer,
        type: hasVideo ? 'video' : 'audio',
      });
    });

    socket.on('webrtc:answer', async ({ conversationId, answer }) => {
      if (!peerRef.current || !selectedThread || selectedThread.id !== conversationId) return;
      await peerRef.current.setRemoteDescription(answer);
      setCallState((prev) => ({ ...prev, status: 'connected' }));
    });

    socket.on('webrtc:ice', async ({ conversationId, candidate }) => {
      if (!peerRef.current || !selectedThread || selectedThread.id !== conversationId) return;
      if (candidate) {
        try {
          await peerRef.current.addIceCandidate(candidate);
        } catch (error) {
          // ignore
        }
      }
    });

    socket.on('webrtc:hangup', ({ conversationId }) => {
      if (!selectedThread || selectedThread.id !== conversationId) return;
      endCall(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken, selectedThread]);

  const handleLogin = async ({ email, password }) => {
    try {
      setAuthState({ loading: true, error: '' });
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion.');
      }
      setAuthToken(data.token);
      localStorage.setItem('authToken', data.token);
      setAuthState({ loading: false, error: '' });
    } catch (error) {
      setAuthState({ loading: false, error: error.message });
    }
  };

  const handleRegister = async ({ name, email, password }) => {
    try {
      setAuthState({ loading: true, error: '' });
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de création.');
      }
      setAuthToken(data.token);
      localStorage.setItem('authToken', data.token);
      setAuthState({ loading: false, error: '' });
    } catch (error) {
      setAuthState({ loading: false, error: error.message });
    }
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    localStorage.removeItem('authToken');
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedThread || !authToken) return;
    try {
      const response = await authFetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedThread.id, text: messageText.trim() }),
      });
      const data = await response.json();
      setMessagesList((prev) => (prev.some((item) => item.id === data.id) ? prev : [...prev, data]));
      setMessageText('');
      loadThreads();
      loadAlerts();
    } catch (error) {
      // ignore
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchQuery('');
    }
  };

  const createPeer = (conversationId) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc:ice', {
          conversationId,
          candidate: event.candidate,
        });
      }
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      remoteStreamRef.current = stream;
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        endCall(false);
      }
    };

    peerRef.current = peer;
    return peer;
  };

  const startCall = async (type) => {
    if (!selectedThread || !socketRef.current) return;
    try {
      setCallState({ active: true, type, status: 'calling' });
      const constraints =
        type === 'video' ? { audio: true, video: true } : { audio: true, video: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      const peer = createPeer(selectedThread.id);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socketRef.current.emit('webrtc:offer', {
        conversationId: selectedThread.id,
        offer,
      });
    } catch (error) {
      setCallState({ active: false, type: null, status: '' });
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !socketRef.current) return;
    const conversationId = incomingCall.conversationId;
    try {
      const nextType = incomingCall.type === 'video' ? 'video' : 'audio';
      setCallState({ active: true, type: nextType, status: 'connecting' });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: nextType === 'video',
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const peer = createPeer(conversationId);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(incomingCall.offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socketRef.current.emit('webrtc:answer', {
        conversationId,
        answer,
      });
      setIncomingCall(null);
      setCallState((prev) => ({ ...prev, status: 'connected' }));
    } catch (error) {
      setIncomingCall(null);
      endCall(false);
    }
  };

  const endCall = (emit = true) => {
    if (emit && socketRef.current && selectedThread) {
      socketRef.current.emit('webrtc:hangup', { conversationId: selectedThread.id });
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState({ active: false, type: null, status: '' });
    setIncomingCall(null);
  };

  const handleDeleteMessage = async (messageId) => {
    const confirmed = window.confirm(t.messages_delete_confirm);
    if (!confirmed) return;
    await authFetch(`${API_BASE}/api/messages/${messageId}`, { method: 'DELETE' });
    setMessagesList((prev) => prev.filter((item) => item.id !== messageId));
    loadThreads();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff6e8] via-[#f4f7f2] to-[#e9f2f7] text-slate-900">
      <LanguageSwitcher lang={lang} setLang={setLang} />
      <Header
        t={t}
        lang={lang}
        hubmatesCount={alerts.pendingRequests}
        messagesCount={alerts.unreadMessages}
        rightSlot={(
          <div className="w-72">
            <SearchBar
              placeholder={t.search_placeholder}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onSearch={handleSearch}
              buttonText={t.search_button}
              lang={lang}
            />
          </div>
        )}
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!currentUser ? (
          <div className="max-w-md mx-auto">
            <AuthCard
              t={t}
              lang={lang}
              user={currentUser}
              onLogin={handleLogin}
              onRegister={handleRegister}
              onLogout={handleLogout}
              loading={authState.loading}
              error={authState.error}
            />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[0.35fr_0.65fr] gap-6">
            <aside className="bg-white/90 border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setBox('inbox')}
                  className={`text-xs border px-3 py-1 rounded-lg ${box === 'inbox' ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-slate-200 text-slate-600'}`}
                >
                  {t.messages_inbox}
                </button>
                <button
                  onClick={() => setBox('spam')}
                  className={`text-xs border px-3 py-1 rounded-lg ${box === 'spam' ? 'border-rose-300 bg-rose-100 text-rose-700' : 'border-slate-200 text-slate-600'}`}
                >
                  {t.messages_spam}
                </button>
              </div>
              {threads.length === 0 ? (
                <p className="text-sm text-slate-500">{t.messages_empty}</p>
              ) : (
                <div className="space-y-2">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => {
                        setSelectedThread(thread);
                        loadMessages(thread.id);
                      }}
                      className={`w-full text-left border rounded-xl px-3 py-2 ${selectedThread?.id === thread.id ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-white'}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{thread.title || t.messages_thread}</p>
                        {thread.unreadCount > 0 && (
                          <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{thread.lastMessage || t.messages_no_message}</p>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <section className="bg-white/90 border border-slate-100 rounded-2xl p-4 flex flex-col min-h-[520px]">
              {!selectedThread ? (
                <div className="text-sm text-slate-500">{t.messages_select}</div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-sm font-semibold">{selectedThread.title || t.messages_thread}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startCall('audio')}
                        className="text-xs border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                      >
                        {t.call_audio}
                      </button>
                      <button
                        onClick={() => startCall('video')}
                        className="text-xs border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                      >
                        {t.call_video}
                      </button>
                      {callState.active && (
                        <button
                          onClick={() => endCall(true)}
                          className="text-xs border border-rose-200 text-rose-600 px-3 py-1 rounded-lg hover:bg-rose-50"
                        >
                          {t.call_end}
                        </button>
                      )}
                    </div>
                  </div>
                  {incomingCall && (
                    <div className="mb-3 p-3 border border-amber-200 bg-amber-50 rounded-xl flex items-center justify-between">
                      <div className="text-sm">{t.call_incoming}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={acceptCall}
                          className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg"
                        >
                          {t.call_accept}
                        </button>
                        <button
                          onClick={() => endCall(true)}
                          className="text-xs border border-slate-200 px-3 py-1 rounded-lg"
                        >
                          {t.call_decline}
                        </button>
                      </div>
                    </div>
                  )}
                  {callState.active && (
                    <div className="mb-3 grid sm:grid-cols-2 gap-3">
                      <div className="bg-slate-100 rounded-xl p-2 text-xs text-slate-500">
                        Local audio {localStream ? 'actif' : '...'}
                      </div>
                      <div className="bg-slate-100 rounded-xl p-2 text-xs text-slate-500">
                        Remote audio {remoteStream ? 'actif' : '...'}
                      </div>
                      {callState.type === 'video' && (
                        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
                          <video
                            autoPlay
                            muted
                            playsInline
                            ref={(el) => {
                              if (el && localStream) {
                                el.srcObject = localStream;
                              }
                            }}
                            className="w-full h-48 bg-black rounded-xl object-cover"
                          />
                          <video
                            autoPlay
                            playsInline
                            ref={(el) => {
                              if (el && remoteStream) {
                                el.srcObject = remoteStream;
                              }
                            }}
                            className="w-full h-48 bg-black rounded-xl object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {messagesList.length === 0 ? (
                      <p className="text-sm text-slate-500">{t.messages_no_message}</p>
                    ) : (
                      messagesList.map((msg) => {
                        const isMine = msg.fromUserId === currentUser?.id;
                        const displayName = isMine
                          ? t.messages_you
                          : msg.fromUserName || selectedThread?.title || t.messages_thread;
                        return (
                          <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMine ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-100'}`}>
                              <div className={`text-[11px] mb-1 ${isMine ? 'text-slate-200' : 'text-slate-400'}`}>
                                {displayName}
                              </div>
                              <div>{msg.text}</div>
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className={`mt-2 text-[10px] underline ${isMine ? 'text-rose-200' : 'text-rose-300'}`}
                              >
                                {t.messages_delete}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder={t.messages_placeholder}
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-full bg-white"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="bg-amber-600 text-white px-5 py-3 rounded-full hover:bg-amber-500 transition"
                      >
                        {t.send_button}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer t={t} lang={lang} />
    </div>
  );
}
