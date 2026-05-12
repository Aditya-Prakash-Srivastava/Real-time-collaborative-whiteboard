import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, LogOut, Lock, X, Eye, EyeOff, Loader2, Home, LayoutGrid, Plus, Copy, Edit2, Users, Link as LinkIcon, UserPlus, LogOut as LeaveIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { Excalidraw, getSceneVersion } from '@excalidraw/excalidraw';
import { socketService } from '../socket';

const Whiteboard = () => {
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New UI states
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomLinkInput, setRoomLinkInput] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  const [currentRoom, setCurrentRoom] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Phase 5: Presence & Cursors state
  const [roomUsers, setRoomUsers] = useState([]);
  const [collaborators, setCollaborators] = useState(new Map());
  const lastPointerUpdateRef = useRef(0);
  const lastSceneVersionRef = useRef(0);
  const lastBoardUpdateRef = useRef(0);

  // Initialize room from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setCurrentRoom(room);
    }
  }, []);

  // Phase 1: Excalidraw Foundation Refs & State
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const debounceTimer = useRef(null);
  
  // Phase 3: Synchronization Stability Refs
  const isUpdatingRef = useRef(false);
  const lastSyncVersionRef = useRef(0);
  
  // Refs for current values to avoid stale closures in callbacks/effects
  const excalidrawAPIRef = useRef(null);
  const currentRoomRef = useRef(currentRoom);

  useEffect(() => { excalidrawAPIRef.current = excalidrawAPI; }, [excalidrawAPI]);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);



  useEffect(() => {
    // Decode JWT token to get email and name
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload && payload.email) {
          setUserEmail(payload.email);
          setUserName(payload.email.split('@')[0]); // Use part before @ as name
        }
        
        // STEP 5 & 6: Connect to socket with JWT token
        const socket = socketService.connect(token);
        
        // Clean up any existing listeners just in case
        socket.off('connect');
        socket.off('board:update');

        const handleConnect = () => {
          if (currentRoomRef.current && excalidrawAPIRef.current) {
            socket.emit('room:join', currentRoomRef.current);
          }
        };

        if (socket.connected) {
          handleConnect();
        } else {
          socket.on('connect', handleConnect);
        }

        // STEP 16: Handle initial state from MongoDB
        socket.on('initial:state', (data) => {
          if (data.roomId !== currentRoomRef.current) return;
          if (!excalidrawAPIRef.current) return;
          
          isUpdatingRef.current = true;
          lastSyncVersionRef.current = data.version;

          excalidrawAPIRef.current.updateScene({
            elements: data.elements,
            commitToHistory: true // Add to history so user can undo their first stroke relative to the fetched state
          });
        });

        // Phase 5: Listen for user list updates
        socket.on('room:users', (users) => {
          setRoomUsers(users);
          setCollaborators(prev => {
            const newMap = new Map(prev);
            users.forEach(u => {
              const existing = newMap.get(u.id) || {};
              newMap.set(u.id, {
                ...existing,
                username: u.username,
                color: u.color,
                id: u.id
              });
            });
            // Remove disconnected users
            for (const key of newMap.keys()) {
              if (!users.find(u => u.id === key)) {
                newMap.delete(key);
              }
            }
            return newMap;
          });
        });

        // Phase 5: Listen for remote cursor movements
        socket.on('pointer:update', (data) => {
          if (!excalidrawAPIRef.current) return;
          
          setCollaborators(prev => {
            const newMap = new Map(prev);
            const user = newMap.get(data.userId);
            if (user) {
              newMap.set(data.userId, {
                ...user,
                pointer: data.pointer
              });
            }
            return newMap;
          });
        });

        // STEP 8: Listen for remote board updates
        socket.on('board:update', (data) => {
          // If update belongs to a different room, ignore
          if (data.roomId !== currentRoomRef.current) return;
          if (!excalidrawAPIRef.current) return;
          
          // STEP 10: Prevent infinite sync loops.
          // Set flag before applying remote updates to prevent local onChange from re-broadcasting
          isUpdatingRef.current = true;
          lastSyncVersionRef.current = data.version;

          // STEP 9: Use updateScene properly to avoid infinite loops
          // STEP 12: Excalidraw's updateScene automatically uses internal element `version` properties for reconciliation
          excalidrawAPIRef.current.updateScene({
            elements: data.elements,
            commitToHistory: false // Don't pollute local history with remote changes
          });
        });

        // Phase 7: Listen for hard clear
        socket.on('board:clear', () => {
          if (!excalidrawAPIRef.current) return;
          isUpdatingRef.current = true;
          excalidrawAPIRef.current.resetScene();
        });

        return () => {
          socket.off('connect');
          socket.off('initial:state');
          socket.off('room:users');
          socket.off('pointer:update');
          socket.off('board:update');
          socket.off('board:clear');
        };

      } catch (err) {
        console.error('Failed to parse token or connect socket', err);
      }
    }
  }, []);

  // Re-join socket room when currentRoom or excalidrawAPI state changes
  useEffect(() => {
    const socket = socketService.getSocket();
    if (socket && socket.connected && currentRoom && excalidrawAPI) {
      socket.emit('room:join', currentRoom);
    }
  }, [currentRoom, excalidrawAPI]);

  // Phase 5: Update Excalidraw scene with collaborators when they change
  useEffect(() => {
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({ collaborators });
    }
  }, [collaborators, excalidrawAPI]);

  // Room Management Handlers
  const updateURLRoom = (room) => {
    const url = new URL(window.location);
    if (room) {
      url.searchParams.set('room', room);
    } else {
      url.searchParams.delete('room');
    }
    window.history.pushState({}, '', url);
  };

  const handleCreateRoom = () => {
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCurrentRoom(newRoomCode);
    updateURLRoom(newRoomCode);
    setShowBanner(true);
  };

  const handleJoinByCode = () => {
    if (!roomCodeInput.trim()) return;
    const code = roomCodeInput.trim().toUpperCase();
    setCurrentRoom(code);
    updateURLRoom(code);
    setRoomCodeInput('');
    setShowBanner(true);
  };

  const handleJoinByLink = () => {
    if (!roomLinkInput.trim()) return;
    try {
      const url = new URL(roomLinkInput);
      const room = url.searchParams.get('room');
      if (room) {
        setCurrentRoom(room);
        updateURLRoom(room);
        setRoomLinkInput('');
        setShowBanner(true);
      } else {
        alert("Invalid room link. It should contain '?room=CODE'");
      }
    } catch (e) {
      // If it's just a code pasted in the link box
      const code = roomLinkInput.trim().toUpperCase();
      if (code.length === 6) {
        setCurrentRoom(code);
        updateURLRoom(code);
        setRoomLinkInput('');
        setShowBanner(true);
      } else {
        alert("Invalid URL format");
      }
    }
  };

  const handleLeaveRoom = () => {
    setCurrentRoom('');
    updateURLRoom('');
  };

  const handleShareLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Phase 7: Hard clear the room
  const handleClearBoard = () => {
    if (window.confirm('Are you sure you want to completely erase this room for everyone? This cannot be undone.')) {
      const socket = socketService.getSocket();
      if (socket && socket.connected && currentRoomRef.current) {
        socket.emit('board:clear', currentRoomRef.current);
        if (excalidrawAPIRef.current) {
          isUpdatingRef.current = true;
          excalidrawAPIRef.current.resetScene();
        }
      }
    }
  };

  // Debounced Excalidraw onChange handler (Phase 1 & Phase 3)
  const handleExcalidrawChange = useCallback((elements, state) => {
    // getSceneVersion calculates a version based on the elements.
    // It properly detects inline mutations during dragging!
    const currentVersion = getSceneVersion(elements);
    const elementsChanged = lastSceneVersionRef.current !== currentVersion;
    lastSceneVersionRef.current = currentVersion;

    // STEP 10: Prevent infinite sync loops
    // If the change was triggered by a remote update, ignore it and clear the flag
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }

    // If scene version hasn't changed, this onChange was triggered by appState change
    // or collaborators update. We do NOT want to broadcast in this case to avoid loops!
    if (!elementsChanged) {
      return;
    }

    // Phase 5: Throttle with trailing-edge guarantee for real-time feel without dropping the final stroke
    const emitUpdate = (elems) => {
      const socket = socketService.getSocket();
      const room = currentRoomRef.current;
      if (socket && socket.connected && room) {
        socket.emit('board:update', {
          roomId: room,
          elements: elems,
          version: Date.now()
        });
      }
    };

    const now = Date.now();
    if (now - lastBoardUpdateRef.current >= 50) {
      // It's been 50ms since last emit, emit immediately (leading edge)
      emitUpdate(elements);
      lastBoardUpdateRef.current = now;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    } else {
      // It hasn't been 50ms, schedule a trailing edge emit
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        emitUpdate(elements);
        lastBoardUpdateRef.current = Date.now();
      }, 50 - (now - lastBoardUpdateRef.current));
    }
  }, []);

  // Phase 5: Handle local cursor movement
  const handlePointerUpdate = useCallback((payload) => {
    const now = Date.now();
    // Throttle to 50ms to avoid network spam
    if (now - lastPointerUpdateRef.current < 50) return;
    lastPointerUpdateRef.current = now;

    const socket = socketService.getSocket();
    const room = currentRoomRef.current;
    if (socket && socket.connected && room) {
      socket.emit('pointer:update', {
        roomId: room,
        pointer: payload.pointer
      });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      
      setSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
          <div className="w-8 h-8 bg-[#4B53E3] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">Whiteboard</span>
        </div>

        {/* Navigation */}
        <nav className="px-4 space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-[#4B53E3]/10 text-[#4B53E3] rounded-lg font-medium text-sm transition-colors">
            <Home className="w-5 h-5" />
            Home
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <LayoutGrid className="w-5 h-5" />
            Rooms
          </a>
        </nav>

        {/* Create Room */}
        <div className="px-4 mt-8">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 tracking-wider uppercase">Create Room</h3>
          <button onClick={handleCreateRoom} className="w-full bg-[#4B53E3] hover:bg-[#3D44C2] text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm text-sm">
            <Plus className="w-4 h-4" />
            Create Room
          </button>
        </div>

        {/* Join Room */}
        <div className="px-4 mt-8 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 tracking-wider uppercase">Join Room</h3>
          
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-4 shadow-sm">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Join with Room Code</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter room code" 
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4B53E3]/30 focus:border-[#4B53E3] transition-colors"
                />
                <button onClick={handleJoinByCode} className="bg-[#4B53E3] text-white px-4 rounded-md text-sm font-medium hover:bg-[#3D44C2] transition-colors">Join</button>
              </div>
            </div>

            <div className="flex items-center gap-3 py-1 relative">
              <div className="flex-1 h-px bg-slate-200"></div>
              <span className="text-xs text-slate-400 font-medium bg-slate-50 px-1">or</span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Join with Link</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Paste room link here" 
                  value={roomLinkInput}
                  onChange={(e) => setRoomLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinByLink()}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4B53E3]/30 focus:border-[#4B53E3] transition-colors"
                />
                <button onClick={handleJoinByLink} className="bg-[#4B53E3] text-white px-4 rounded-md text-sm font-medium hover:bg-[#3D44C2] transition-colors">Join</button>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile (Bottom Left) */}
        <div className="p-4 border-t border-slate-200 relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-[#4B53E3] text-white flex items-center justify-center font-semibold flex-shrink-0 text-sm">
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col items-start truncate">
                <span className="text-sm font-medium text-slate-900 truncate w-full text-left">{userName || 'User'}</span>
                <span className="text-xs text-slate-500 truncate w-full text-left">{userEmail || 'Loading...'}</span>
              </div>
            </div>
            {isProfileOpen ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          </button>

          {/* Profile Dropdown Logic */}
          {isProfileOpen && (
             <div className="absolute bottom-[calc(100%+8px)] left-4 w-[248px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                <div className="p-2">
                  {!showPasswordForm ? (
                    <button 
                      onClick={() => {
                        setShowPasswordForm(true);
                        setError('');
                        setSuccess('');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
                    >
                      <Lock className="w-4 h-4 text-slate-400" />
                      Change Password
                    </button>
                  ) : (
                    <div className="p-2 pt-1 border border-slate-100 rounded-lg bg-slate-50/50 mb-2">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-700">Update Password</span>
                        <button onClick={() => setShowPasswordForm(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">{error}</div>}
                      {success && <div className="mb-3 p-2 bg-green-50 text-green-600 text-xs rounded border border-green-100">{success}</div>}

                      <form onSubmit={handleChangePassword} className="space-y-3">
                        <div className="relative">
                          <input
                            type={showPwd ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#4B53E3]"
                          />
                          <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showConfirmPwd ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#4B53E3]"
                          />
                          <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showConfirmPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button 
                          type="submit" 
                          disabled={loading}
                          className="w-full bg-[#4B53E3] hover:bg-[#3D44C2] text-white py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                          Save Password
                        </button>
                      </form>
                    </div>
                  )}

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors mt-1"
                  >
                    <LeaveIcon className="w-4 h-4" />
                    Logout
                  </button>
                </div>
             </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col bg-white min-w-0" onClick={() => { if(isProfileOpen) setIsProfileOpen(false) }}>
        {/* Top Header */}
        <header className="h-[76px] bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 leading-none">Design Brainstorm</h2>
              <button className="text-slate-400 hover:text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
              <span>Room Code: <span className="font-semibold text-[#4B53E3]">{currentRoom || 'None'}</span></span>
              <button onClick={handleShareLink} className="hover:text-slate-700 relative" disabled={!currentRoom} title="Copy Room Link">
                <Copy className="w-3.5 h-3.5" />
                {copySuccess && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-md whitespace-nowrap z-50">Link Copied!</span>}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-slate-600 mr-2">
              <Users className="w-4 h-4" />
              <span>{roomUsers.length > 0 ? roomUsers.length : 1}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-2"></span>
              <span>Online</span>
            </div>
            
            {/* Phase 7: Clear Board Button */}
            {currentRoom && (
              <button 
                onClick={handleClearBoard}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[13px] font-medium transition-colors"
                title="Completely erase the room for everyone"
              >
                Reset Room
              </button>
            )}

            <button onClick={handleShareLink} disabled={!currentRoom} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50">
              <LinkIcon className="w-4 h-4" />
              Share Link
            </button>
            <button onClick={handleShareLink} disabled={!currentRoom} className="flex items-center gap-2 px-4 py-2 bg-[#4B53E3] hover:bg-[#3D44C2] text-white rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-50">
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
            <button onClick={handleLeaveRoom} disabled={!currentRoom} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors ml-2 shadow-sm disabled:opacity-50">
              <LeaveIcon className="w-4 h-4" />
              Leave Room
            </button>
          </div>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 p-6 flex flex-col relative overflow-hidden bg-slate-50/30">
          {/* Banner */}
          {currentRoom && showBanner && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center justify-between mb-6 shadow-sm z-10 flex-shrink-0">
              <div className="flex items-center gap-2.5 text-emerald-800 text-sm font-medium">
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                </div>
                You've joined room {currentRoom}. Start drawing and collaborate in real time!
              </div>
              <button onClick={() => setShowBanner(false)} className="text-emerald-600 hover:text-emerald-800 p-1"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* The actual board container */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm relative overflow-hidden flex flex-col">
            
            {/* Active Users (Bottom Right Overlay) */}
            {roomUsers.length > 0 && (
              <div className="absolute right-4 bottom-4 bg-white border border-slate-200 rounded-full shadow-sm py-1.5 px-3 flex items-center gap-3 z-10">
                <div className="flex -space-x-2">
                  {roomUsers.slice(0, 4).map((user, idx) => (
                    <div 
                      key={user.id} 
                      className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: user.color, zIndex: 40 - idx }}
                      title={user.username}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {roomUsers.length > 4 && (
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold z-0">
                      +{roomUsers.length - 4}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 border-l border-slate-200 pl-3">
                  <Plus className="w-3 h-3" />
                  <span>{roomUsers.length} online</span>
                </div>
              </div>
            )}

            {/* Excalidraw Canvas (Phase 1, Step 1) */}
            <div className="w-full h-full relative" style={{ height: '100%', width: '100%' }}>
              {currentRoom ? (
                <Excalidraw 
                  excalidrawAPI={(api) => setExcalidrawAPI(api)}
                  onChange={handleExcalidrawChange}
                  onPointerUpdate={handlePointerUpdate}
                  UIOptions={{
                    canvasActions: {
                      loadScene: false,
                      export: false,
                      saveAsImage: false
                    }
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50">
                  <div className="w-16 h-16 bg-[#4B53E3]/10 text-[#4B53E3] rounded-2xl flex items-center justify-center mb-4">
                    <LayoutGrid className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">No Room Selected</h3>
                  <p className="text-sm text-slate-500 max-w-sm text-center">Create a new room or join an existing one using the sidebar to start collaborating.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Whiteboard;
