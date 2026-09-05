import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, MonitorSmartphone } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';

interface LanPeer {
  deviceId: string;
  ip: string;
  port: number;
  name: string;
  lastSeen: number;
}

interface LanToast {
  id: number;
  kind: 'join' | 'leave';
  text: string;
}

// Badge + instant join/leave toasts for LAN peer devices (Ethernet/WiFi).
// - Polls GET /api/lan/peers every 10s (fallback).
// - Listens to socket `lan:peer-up` / `lan:peer-down` for instant updates
//   (server emits them the moment UDP discovery sees a device join/leave).
// - Shows a clear toast so the user knows another device connected.
const LanStatusBadge = () => {
  const [peers, setPeers] = useState<LanPeer[]>([]);
  const [reachable, setReachable] = useState(false);
  const [toasts, setToasts] = useState<LanToast[]>([]);
  const knownPeersRef = useRef<Map<string, LanPeer>>(new Map());
  const toastIdRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);

  const pushToast = (kind: 'join' | 'leave', text: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, kind, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // Diff peer lists and announce joins/leaves (used by both poll + socket).
  const applyPeers = (next: LanPeer[], source: 'poll' | 'socket') => {
    const prev = knownPeersRef.current;
    const nextMap = new Map(next.map((p) => [p.deviceId, p]));
    for (const [id, peer] of nextMap) {
      if (!prev.has(id)) {
        pushToast('join', `تم اتصال جهاز: ${peer.name || 'جهاز آخر'} (${peer.ip}) — المزامنة لحظية الآن`);
      }
    }
    for (const [id, peer] of prev) {
      if (!nextMap.has(id)) {
        pushToast('leave', `انقطع جهاز: ${peer.name || 'جهاز آخر'} (${peer.ip}) — بياناتك محفوظة على هذا الجهاز`);
      }
    }
    knownPeersRef.current = nextMap;
    setPeers(next);
    if (source === 'poll') setReachable(true);
  };

  useEffect(() => {
    let cancelled = false;
    const fetchPeers = async (announce = true) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/lan/peers`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        // Skip join-toasts on the very first load (devices already there).
        const list: LanPeer[] = Array.isArray(data.peers) ? data.peers : [];
        if (!announce) {
          knownPeersRef.current = new Map(list.map((p) => [p.deviceId, p]));
          setPeers(list);
        } else {
          applyPeers(list, 'poll');
        }
        setReachable(true);
      } catch {
        if (!cancelled) setReachable(false);
      }
    };

    fetchPeers(false);
    const timer = setInterval(() => fetchPeers(true), 10000);

    // Instant path: server pushes peer-up/peer-down over socket.io.
    try {
      const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
      const socket: Socket = io(socketUrl, {
        path: '/socket.io/',
        auth: { token: localStorage.getItem('token') || undefined },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      socketRef.current = socket;
      socket.on('lan:peer-up', (peer: LanPeer) => {
        if (cancelled || !peer?.deviceId) return;
        setPeers((prev) => {
          if (prev.some((p) => p.deviceId === peer.deviceId)) return prev;
          const next = [...prev, peer];
          applyPeers(next, 'socket');
          return next;
        });
        setReachable(true);
      });
      socket.on('lan:peer-down', (peer: LanPeer) => {
        if (cancelled || !peer?.deviceId) return;
        setPeers((prev) => {
          if (!prev.some((p) => p.deviceId === peer.deviceId)) return prev;
          const next = prev.filter((p) => p.deviceId !== peer.deviceId);
          applyPeers(next, 'socket');
          return next;
        });
      });
    } catch {
      // Socket unavailable — polling fallback still works.
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      try {
        socketRef.current?.off('lan:peer-up');
        socketRef.current?.off('lan:peer-down');
        socketRef.current?.disconnect();
      } catch {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {reachable && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            peers.length > 0
              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
              : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
          }`}
          title={
            peers.length > 0
              ? `أجهزة متصلة عبر الشبكة المحلية (${peers.length}):\n` +
                peers.map((p) => `• ${p.name} (${p.ip}:${p.port})`).join('\n')
              : 'لا توجد أجهزة أخرى على الشبكة المحلية — وصّل سلك Ethernet بين الجهازين'
          }
        >
          <span className="relative flex h-2 w-2">
            {peers.length > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${peers.length > 0 ? 'bg-green-500' : 'bg-gray-400'}`}
            />
          </span>
          {peers.length > 0 ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span>
            {peers.length > 0
              ? `LAN: متصل • ${peers.length === 1 ? 'جهاز واحد' : `${peers.length} أجهزة`} (${peers[0].ip})`
              : 'LAN: غير متصل'}
          </span>
        </div>
      )}

      {/* Join/leave toasts — bottom center, auto-dismiss */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] flex flex-col gap-2 items-center pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-sm font-bold text-white animate-bounce ${
                t.kind === 'join' ? 'bg-green-600' : 'bg-amber-600'
              }`}
            >
              <MonitorSmartphone className="h-4 w-4" />
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default LanStatusBadge;
