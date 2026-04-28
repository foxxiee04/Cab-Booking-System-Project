import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Fab,
  Fade,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ChatBubbleRounded,
  Close,
  Send,
  Phone,
  WifiOff,
  MinimizeRounded,
} from '@mui/icons-material';
import { ChatMessage, useRideChat } from '../hooks/useRideChat';
import { CallState, useWebRTCCall } from '../hooks/useWebRTCCall';
import RideCall from './RideCall';

interface ContactBoxProps {
  token: string | null | undefined;
  rideId: string | null | undefined;
  myUserId?: string | null;
  contactName?: string;
  contactPhone?: string;
  /** 'DRIVER' when current user is driver, 'CUSTOMER' when customer */
  role?: 'DRIVER' | 'CUSTOMER';
  triggerMode?: 'floating' | 'inline';
  panelMode?: 'floating' | 'embedded';
  triggerLabel?: string;
  fullWidthTrigger?: boolean;
  readOnly?: boolean;
}

const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const isSelf = msg.isSelf;
  const time = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <Stack direction="row" justifyContent={isSelf ? 'flex-end' : 'flex-start'} sx={{ mb: 0.75 }}>
      {!isSelf && (
        <Avatar sx={{ width: 24, height: 24, mr: 0.75, bgcolor: 'primary.main', fontSize: 10 }}>
          {msg.role === 'DRIVER' ? 'TX' : 'KH'}
        </Avatar>
      )}
      <Box
        sx={{
          maxWidth: '75%',
          px: 1.25,
          py: 0.6,
          borderRadius: isSelf ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          bgcolor: isSelf ? '#1d4ed8' : '#f1f5f9',
          color: isSelf ? '#fff' : 'text.primary',
        }}
      >
        <Typography variant="body2" sx={{ wordBreak: 'break-word', fontSize: '0.85rem', lineHeight: 1.4 }}>
          {msg.message}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.55, display: 'block', textAlign: 'right', mt: 0.15, fontSize: '0.65rem' }}>
          {time}
        </Typography>
      </Box>
    </Stack>
  );
};

const formatCallDuration = (durationMs: number) => {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${totalSeconds} giây`;
  }

  if (seconds === 0) {
    return `${minutes} phút`;
  }

  return `${minutes} phút ${seconds} giây`;
};

const ContactBox: React.FC<ContactBoxProps> = ({
  token,
  rideId,
  myUserId,
  contactName = 'Liên hệ',
  contactPhone,
  role = 'DRIVER',
  triggerMode = 'floating',
  panelMode,
  triggerLabel = 'Liên hệ',
  fullWidthTrigger = false,
  readOnly = false,
}) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCountRef = useRef(0);
  const didHydrateUnreadRef = useRef(false);
  const previousCallStateRef = useRef<CallState>('idle');
  const activeCallStartedAtRef = useRef<number | null>(null);
  const [lastCallSummary, setLastCallSummary] = useState<{ text: string; timestamp: number } | null>(null);

  const { messages, sendMessage, connected, historyLoaded } = useRideChat(token, rideId, myUserId);
  const { callState, callError, startCall, acceptCall, hangUp } = useWebRTCCall(token, rideId);
  const normalizedContactPhone = contactPhone?.trim() || '';
  const canCall = Boolean(token && rideId && !readOnly);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!historyLoaded) {
      return;
    }

    if (!didHydrateUnreadRef.current) {
      prevMsgCountRef.current = messages.length;
      didHydrateUnreadRef.current = true;
      return;
    }

    if (open) {
      setUnread(0);
      prevMsgCountRef.current = messages.length;
    } else {
      const newCount = messages.length - prevMsgCountRef.current;
      if (newCount > 0) {
        setUnread((prev) => prev + newCount);
        prevMsgCountRef.current = messages.length;
      }
    }
  }, [historyLoaded, messages.length, open]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [messages, open]);

  useEffect(() => {
    if (callState !== 'idle') {
      setOpen(true);
    }
  }, [callState]);

  useEffect(() => {
    const previousCallState = previousCallStateRef.current;

    if (callState === 'active' && previousCallState !== 'active') {
      activeCallStartedAtRef.current = Date.now();
    }

    if (callState === 'ended' && previousCallState !== 'ended') {
      const startedAt = activeCallStartedAtRef.current;
      const durationMs = startedAt ? Date.now() - startedAt : 0;
      setLastCallSummary({
        text: durationMs > 0
          ? `Cuộc gọi đã kết thúc · ${formatCallDuration(durationMs)}`
          : 'Cuộc gọi đã kết thúc',
        timestamp: Date.now(),
      });
      activeCallStartedAtRef.current = null;
    }

    if (callState === 'idle' && previousCallState === 'incoming') {
      activeCallStartedAtRef.current = null;
    }

    previousCallStateRef.current = callState;
  }, [callState]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const inlineTrigger = triggerMode === 'inline';
  const resolvedPanelMode = panelMode || (inlineTrigger ? 'embedded' : 'floating');
  const floatingPanel = resolvedPanelMode === 'floating';
  const showCallPanel = callState !== 'idle';

  if (!rideId) return null;

  const panelContent = (
    <Fade in={open} timeout={200}>
      <Paper
        elevation={16}
        sx={{
          position: floatingPanel ? 'fixed' : 'relative',
          bottom: floatingPanel ? { xs: 144, sm: 96 } : 'auto',
          left: floatingPanel ? { xs: 16, sm: 24 } : 'auto',
          mt: floatingPanel ? 0 : 1.25,
          width: floatingPanel
            ? { xs: 'calc(100vw - 32px)', sm: 420 }
            : '100%',
          maxWidth: floatingPanel ? 440 : '100%',
          maxHeight: { xs: 'calc(100dvh - 140px)', sm: 620 },
          borderRadius: 4,
          overflow: 'hidden',
          display: open ? 'flex' : 'none',
          flexDirection: 'column',
          border: '1px solid rgba(148,163,184,0.2)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          zIndex: floatingPanel ? 1301 : 'auto',
          bgcolor: '#ffffff',
        }}
      >
        <Box
          sx={{
            background: (theme: any) => `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
            color: '#fff',
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
          }}
        >
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 13, fontWeight: 700 }}>
            {contactName[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {contactName}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.84, fontSize: '0.68rem', display: 'block' }} noWrap>
              {normalizedContactPhone || 'Số điện thoại đang cập nhật'}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.72, fontSize: '0.68rem' }}>
              {connected ? '● Đang trực tuyến' : 'Đang kết nối...'}
            </Typography>
          </Box>
          <IconButton
            size="small"
            disabled={!canCall}
            onClick={() => {
              if (!canCall || showCallPanel) {
                return;
              }
              setOpen(true);
              void startCall();
            }}
            sx={{
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.15)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              '&.Mui-disabled': {
                color: 'rgba(255,255,255,0.7)',
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <Phone fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setOpen(false)}
            sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}
          >
            <MinimizeRounded fontSize="small" />
          </IconButton>
        </Box>

        {showCallPanel ? (
          <RideCall
            embedded
            showIdleButton={false}
            callState={callState}
            callError={callError}
            contactName={contactName}
            onStart={() => void startCall()}
            onAccept={() => void acceptCall()}
            onHangUp={hangUp}
            onClose={() => setOpen(false)}
          />
        ) : (
          <>
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                py: 1.5,
                px: 1.5,
                minHeight: 320,
                maxHeight: 460,
                bgcolor: '#ffffff',
              }}
            >
              {lastCallSummary && (
                <Box
                  sx={{
                    alignSelf: 'center',
                    mb: 1.25,
                    px: 1.25,
                    py: 0.7,
                    borderRadius: 999,
                    bgcolor: '#eff6ff',
                    color: '#1d4ed8',
                    maxWidth: '90%',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'center', display: 'block' }}>
                    {lastCallSummary.text}
                  </Typography>
                </Box>
              )}
              {messages.length === 0 && (
                <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary', py: 3 }}>
                  <ChatBubbleRounded sx={{ fontSize: 36, opacity: 0.15, mb: 0.75 }} />
                  <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    {readOnly ? 'Chưa có tin nhắn nào trong chuyến đi này' : 'Bắt đầu cuộc trò chuyện'}
                  </Typography>
                </Box>
              )}
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </Box>

            <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fafbfc' }}>
              {!connected && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <WifiOff sx={{ fontSize: 12 }} color="error" />
                  <Typography variant="caption" color="error">Đang kết nối lại...</Typography>
                </Stack>
              )}
              {readOnly && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  Chuyến đi đã kết thúc. Bạn chỉ có thể xem lại lịch sử trò chuyện.
                </Typography>
              )}
              <TextField
                fullWidth
                size="small"
                placeholder={readOnly ? 'Chỉ xem lại lịch sử trò chuyện' : 'Nhập tin nhắn...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={readOnly || !connected}
                multiline
                maxRows={3}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    fontSize: '0.85rem',
                    bgcolor: '#fff',
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={handleSend}
                        disabled={readOnly || !connected || !input.trim()}
                      >
                        <Send fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </>
        )}
      </Paper>
    </Fade>
  );

  return (
    <Box
      sx={{
        position: !inlineTrigger && floatingPanel ? 'fixed' : 'relative',
        bottom: !inlineTrigger && floatingPanel ? { xs: 80, sm: 24 } : 'auto',
        left: !inlineTrigger && floatingPanel ? { xs: 16, sm: 24 } : 'auto',
        zIndex: floatingPanel ? 1300 : 4,
        width: inlineTrigger && fullWidthTrigger ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: inlineTrigger && fullWidthTrigger ? 'stretch' : 'flex-start',
      }}
    >
      {floatingPanel && panelContent}

      <Badge
        badgeContent={unread}
        color="error"
        overlap="circular"
        invisible={unread === 0 || open}
        sx={{
          display: inlineTrigger && fullWidthTrigger ? 'block' : 'inline-flex',
          width: inlineTrigger && fullWidthTrigger ? '100%' : 'auto',
          '& .MuiBadge-badge': {
            top: inlineTrigger ? 12 : 6,
            right: inlineTrigger ? 16 : 6,
          },
        }}
      >
        {inlineTrigger ? (
          <Button
            variant={open ? 'contained' : 'outlined'}
            fullWidth={fullWidthTrigger}
            startIcon={open ? <Close /> : <ChatBubbleRounded />}
            onClick={() => setOpen((prev) => !prev)}
            sx={{ borderRadius: 3, py: 1.2, fontWeight: 700, minWidth: fullWidthTrigger ? undefined : 148 }}
          >
            {open ? 'Đóng liên hệ' : triggerLabel}
          </Button>
        ) : (
          <Fab
            size="large"
            onClick={() => setOpen((prev) => !prev)}
            sx={{
              width: 60,
              height: 60,
              background: open
                ? 'linear-gradient(135deg, #475569, #64748b)'
                : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 55%, #4f46e5 100%)',
              color: '#fff',
              boxShadow: open
                ? '0 4px 12px rgba(0,0,0,0.2)'
                : '0 6px 24px rgba(37,99,235,0.45)',
              transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)',
              transform: open ? 'rotate(90deg) scale(0.95)' : 'scale(1)',
              '&:hover': {
                background: open
                  ? 'linear-gradient(135deg, #334155, #475569)'
                  : 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 55%, #4338ca 100%)',
                transform: open ? 'rotate(90deg) scale(0.95)' : 'scale(1.06)',
              },
              // Pulse animation when there are unread messages
              ...(unread > 0 && !open && {
                animation: 'fabPulse 1.8s ease-in-out infinite',
                '@keyframes fabPulse': {
                  '0%,100%': { boxShadow: '0 6px 24px rgba(37,99,235,0.45)' },
                  '50%':     { boxShadow: '0 6px 32px rgba(37,99,235,0.75), 0 0 0 8px rgba(37,99,235,0.12)' },
                },
              }),
            }}
          >
            {open
              ? <Close sx={{ fontSize: 24 }} />
              : <ChatBubbleRounded sx={{ fontSize: 26 }} />
            }
          </Fab>
        )}
      </Badge>

      {!floatingPanel && panelContent}
    </Box>
  );
};

export default ContactBox;
