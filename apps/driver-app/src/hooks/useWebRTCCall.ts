import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

const STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallState = 'idle' | 'calling' | 'incoming' | 'active' | 'ended';

export function useWebRTCCall(
  token: string | null | undefined,
  rideId: string | null | undefined,
) {
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingSdp, setIncomingSdp] = useState<RTCSessionDescriptionInit | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Socket setup for WebRTC signaling (separate from the tracking socket)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!token || !rideId) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('ride:subscribe', { rideId });
    });

    socket.on('call:offer', ({ sdp }: { from: string; role: string; sdp: RTCSessionDescriptionInit }) => {
      setIncomingSdp(sdp);
      setCallState('incoming');
    });

    socket.on('call:answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          setCallState('active');
        } catch {
          setCallError('Không thể thiết lập kết nối thoại.');
        }
      }
    });

    socket.on('call:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (pcRef.current && candidate) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
    });

    socket.on('call:end', () => {
      cleanupPeer();
      setCallState('ended');
      setTimeout(() => setCallState('idle'), 2000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, rideId]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const cleanupPeer = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const createPeerConnection = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection(STUN_CONFIG);
    pcRef.current = pc;

    const remoteStream = new MediaStream();

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
      // Play remote audio automatically via a hidden <audio> element
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      remoteAudioRef.current.srcObject = remoteStream;
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current && rideId) {
        socketRef.current.emit('call:ice-candidate', { rideId, candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setCallState('active');
      if (pc.connectionState === 'failed') {
        setCallError('Kết nối bị gián đoạn. Vui lòng thử lại.');
        cleanupPeer();
        setCallState('idle');
      }
    };

    return pc;
  }, [cleanupPeer, rideId]);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  const startCall = useCallback(async () => {
    if (!socketRef.current?.connected || !rideId) return;
    setCallError(null);
    setCallState('calling');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('call:offer', { rideId, sdp: offer });
    } catch {
      setCallError('Không thể truy cập microphone. Vui lòng cấp quyền và thử lại.');
      cleanupPeer();
      setCallState('idle');
    }
  }, [cleanupPeer, createPeerConnection, rideId]);

  const acceptCall = useCallback(async () => {
    if (!socketRef.current?.connected || !rideId || !incomingSdp) return;
    setCallError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit('call:answer', { rideId, sdp: answer });
      setCallState('active');
    } catch {
      setCallError('Không thể truy cập microphone. Vui lòng cấp quyền và thử lại.');
      cleanupPeer();
      setCallState('idle');
    }
  }, [cleanupPeer, createPeerConnection, incomingSdp, rideId]);

  const hangUp = useCallback(() => {
    if (socketRef.current?.connected && rideId) {
      socketRef.current.emit('call:end', { rideId });
    }
    cleanupPeer();
    setCallState('idle');
    setIncomingSdp(null);
  }, [cleanupPeer, rideId]);

  return { callState, callError, startCall, acceptCall, hangUp };
}
