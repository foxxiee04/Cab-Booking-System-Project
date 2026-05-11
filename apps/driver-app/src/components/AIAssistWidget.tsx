import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Chip,
  CircularProgress,
  Fab,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  Fade,
} from '@mui/material';
import {
  SmartToy as BotIcon,
  Close as CloseIcon,
  Send as SendIcon,
  ArrowBack as BackIcon,
  ForumRounded,
  Person as CustomerIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { aiApi, ChatMessage } from '../api/ai.api';
import { useAppSelector } from '../store/hooks';
import { useRideChat, ChatMessage as RideChatMessage } from '../hooks/useRideChat';
import { CallState, useWebRTCCall } from '../hooks/useWebRTCCall';
import RideCall from './RideCall';
import {
  FOXGO_AI_CHAT_TOP_K,
  FOXGO_AI_WELCOME_ASSISTANT,
  FOXGO_QUICK_REPLIES,
  miaOfflineFallbackReply,
} from '../config/foxgoAiUnified';

type AIMessage = { role: 'user' | 'assistant'; content: string; sources?: string[]; isError?: boolean };

const WELCOME: AIMessage = { role: 'assistant', content: FOXGO_AI_WELCOME_ASSISTANT };

function foxgoToChatHistory(messages: AIMessage[]): ChatMessage[] {
  return messages
    .filter((m) => !m.isError && m !== WELCOME)
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));
}

const AIBubble: React.FC<{ msg: AIMessage }> = ({ msg }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', mb: 1 }}>
    <Paper elevation={0} sx={{
      px: 1.75, py: 1, maxWidth: '82%',
      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
      bgcolor: msg.role === 'user' ? 'primary.main' : msg.isError ? '#fff3f3' : '#fff',
      color: msg.role === 'user' ? '#fff' : 'text.primary',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: '0.84rem' }}>
        {msg.content}
      </Typography>
    </Paper>
  </Box>
);

const CustomerBubble: React.FC<{ msg: RideChatMessage }> = ({ msg }) => {
  const time = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return (
    <Stack direction="row" justifyContent={msg.isSelf ? 'flex-end' : 'flex-start'} sx={{ mb: 0.75 }}>
      {!msg.isSelf && (
        <Avatar sx={{ width: 24, height: 24, mr: 0.75, bgcolor: '#0ea5e9', fontSize: 10 }}>KH</Avatar>
      )}
      <Box sx={{
        maxWidth: '75%', px: 1.25, py: 0.6,
        borderRadius: msg.isSelf ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        bgcolor: msg.isSelf ? '#1d4ed8' : '#f1f5f9',
        color: msg.isSelf ? '#fff' : 'text.primary',
      }}>
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
  if (minutes === 0) return `${totalSeconds} giây`;
  if (seconds === 0) return `${minutes} phút`;
  return `${minutes} phút ${seconds} giây`;
};

const AIAssistWidget: React.FC = () => {
  const { accessToken, user } = useAppSelector((s) => s.auth);
  const { currentRide } = useAppSelector((s) => s.ride);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'ai' | 'customer'>('list');
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([WELCOME]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [customerInput, setCustomerInput] = useState('');
  const [aiUnread, setAiUnread] = useState(0);
  const [customerUnread, setCustomerUnread] = useState(0);
  const [lastCallSummary, setLastCallSummary] = useState<{ text: string; timestamp: number } | null>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const customerEndRef = useRef<HTMLDivElement>(null);
  const prevCustomerMsgCount = useRef(0);
  const previousCallStateRef = useRef<CallState>('idle');
  const activeCallStartedAtRef = useRef<number | null>(null);

  const hasActiveRide = Boolean(
    currentRide?.id && !['COMPLETED', 'CANCELLED'].includes(currentRide?.status || ''),
  );
  const customerName = currentRide?.customer
    ? `${(currentRide.customer as any).firstName || ''} ${(currentRide.customer as any).lastName || ''}`.trim() || 'Khách hàng'
    : 'Khách hàng';

  const rideId = hasActiveRide ? currentRide?.id : null;
  const { messages: customerMessages, sendMessage: sendCustomerMessage, connected: customerConnected } = useRideChat(
    hasActiveRide ? accessToken : null,
    rideId,
    user?.id,
  );
  const { callState, callError, startCall, acceptCall, hangUp } = useWebRTCCall(
    hasActiveRide ? accessToken : null,
    rideId,
  );

  // Auto-open customer panel on incoming call
  useEffect(() => {
    if (callState !== 'idle') {
      setOpen(true);
      setActiveTab('customer');
    }
  }, [callState]);

  // Track call duration
  useEffect(() => {
    const prev = previousCallStateRef.current;
    if (callState === 'active' && prev !== 'active') {
      activeCallStartedAtRef.current = Date.now();
    }
    if (callState === 'ended' && prev !== 'ended') {
      const startedAt = activeCallStartedAtRef.current;
      const durationMs = startedAt ? Date.now() - startedAt : 0;
      setLastCallSummary({
        text: durationMs > 0 ? `Cuộc gọi đã kết thúc · ${formatCallDuration(durationMs)}` : 'Cuộc gọi đã kết thúc',
        timestamp: Date.now(),
      });
      activeCallStartedAtRef.current = null;
    }
    if (callState === 'idle' && prev === 'incoming') {
      activeCallStartedAtRef.current = null;
    }
    previousCallStateRef.current = callState;
  }, [callState]);

  // Auto-scroll
  useEffect(() => {
    if (activeTab === 'ai') setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [aiMessages, activeTab]);
  useEffect(() => {
    if (activeTab === 'customer') setTimeout(() => customerEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [customerMessages, activeTab]);

  // Unread counts
  useEffect(() => {
    if (!open || activeTab !== 'customer') {
      const newCount = customerMessages.length - prevCustomerMsgCount.current;
      if (newCount > 0) setCustomerUnread((p) => p + newCount);
    } else {
      setCustomerUnread(0);
    }
    prevCustomerMsgCount.current = customerMessages.length;
  }, [customerMessages.length, open, activeTab]);

  const handleOpen = () => {
    setOpen(true);
    if (hasActiveRide) {
      setActiveTab('customer');
      setCustomerUnread(0);
    } else {
      setActiveTab('list');
    }
  };
  const handleClose = () => setOpen(false);
  const showCallPanel = callState !== 'idle';

  const handleTabSelect = (tab: 'ai' | 'customer') => {
    setActiveTab(tab);
    if (tab === 'ai') setAiUnread(0);
    if (tab === 'customer') setCustomerUnread(0);
  };

  const totalUnread = aiUnread + customerUnread;

  const handleAiSend = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    setAiInput('');
    const userMsg: AIMessage = { role: 'user', content: text };
    const conversation = [...aiMessages, userMsg];
    setAiMessages(conversation);
    setAiLoading(true);
    try {
      const history = foxgoToChatHistory(conversation);
      const { data } = await aiApi.chat({ message: text, history, top_k: FOXGO_AI_CHAT_TOP_K });
      const answer = (data.answer || '').trim();
      if (answer) {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
      } else {
        const fb = miaOfflineFallbackReply(text);
        setAiMessages((prev) => [...prev, { role: 'assistant', content: fb || 'Mình chưa nhận được câu trả lời từ máy chủ. Bạn thử lại sau vài giây nhé!', isError: !fb }]);
      }
    } catch {
      const fb = miaOfflineFallbackReply(text);
      setAiMessages((prev) => [...prev, { role: 'assistant', content: fb || 'Xin lỗi, mình đang gặp sự cố kỹ thuật. Vui lòng thử lại sau ít phút nhé!', isError: !fb }]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, aiMessages]);

  const handleQuickReply = useCallback((text: string) => {
    setAiInput('');
    const userMsg: AIMessage = { role: 'user', content: text };
    const conversation = [...aiMessages, userMsg];
    setAiMessages(conversation);
    setAiLoading(true);
    const history = foxgoToChatHistory(conversation);
    aiApi.chat({ message: text, history, top_k: FOXGO_AI_CHAT_TOP_K })
      .then(({ data }) => {
        const answer = (data.answer || '').trim();
        if (answer) {
          setAiMessages((prev) => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
        } else {
          const fb = miaOfflineFallbackReply(text);
          setAiMessages((prev) => [...prev, { role: 'assistant', content: fb || 'Mình chưa nhận được câu trả lời từ máy chủ. Bạn thử lại sau vài giây nhé!', isError: !fb }]);
        }
      })
      .catch(() => {
        const fb = miaOfflineFallbackReply(text);
        setAiMessages((prev) => [...prev, { role: 'assistant', content: fb || 'Xin lỗi, mình đang gặp sự cố kỹ thuật. Vui lòng thử lại sau ít phút nhé!', isError: !fb }]);
      })
      .finally(() => setAiLoading(false));
  }, [aiMessages]);

  const handleCustomerSend = () => {
    if (!customerInput.trim()) return;
    sendCustomerMessage(customerInput);
    setCustomerInput('');
  };

  const headerGradient = 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)';

  const conversationList = (
    <>
      <Box sx={{ px: 2, py: 1.5, background: headerGradient, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ForumRounded />
        <Typography variant="subtitle1" fontWeight={700} flex={1}>Tin nhắn</Typography>
        <IconButton size="small" onClick={handleClose} sx={{ color: '#fff' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <List disablePadding sx={{ flex: 1, overflow: 'auto' }}>
        <ListItemButton onClick={() => handleTabSelect('ai')} sx={{ py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <ListItemAvatar>
            <Badge badgeContent={aiUnread} color="error" invisible={aiUnread === 0}>
              <Avatar sx={{ bgcolor: '#1d4ed8' }}><BotIcon fontSize="small" /></Avatar>
            </Badge>
          </ListItemAvatar>
          <ListItemText
            primary={<Typography variant="body2" fontWeight={700}>Trợ lý FoxGo</Typography>}
            secondary={<Typography variant="caption" color="text.secondary" noWrap>Hỗ trợ 24/7 · Trả lời tức thì</Typography>}
          />
        </ListItemButton>

        {hasActiveRide && (
          <ListItemButton onClick={() => handleTabSelect('customer')} sx={{ py: 1.5 }}>
            <ListItemAvatar>
              <Badge badgeContent={customerUnread} color="error" invisible={customerUnread === 0}>
                <Avatar sx={{ bgcolor: '#0ea5e9' }}><CustomerIcon fontSize="small" /></Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={<Typography variant="body2" fontWeight={700}>{customerName}</Typography>}
              secondary={
                <Typography variant="caption" color={customerConnected ? 'success.main' : 'text.secondary'} noWrap>
                  {customerConnected ? '● Đang trực tuyến' : 'Đang kết nối...'}
                </Typography>
              }
            />
          </ListItemButton>
        )}

        {!hasActiveRide && (
          <ListItem sx={{ py: 2 }}>
            <ListItemText
              secondary={<Typography variant="caption" color="text.secondary">Cuộc trò chuyện với khách hàng sẽ xuất hiện khi bạn có chuyến đang hoạt động.</Typography>}
            />
          </ListItem>
        )}
      </List>
    </>
  );

  const aiPanel = (
    <>
      <Box sx={{ px: 1.5, py: 1.25, background: headerGradient, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setActiveTab('list')} sx={{ color: '#fff' }}><BackIcon fontSize="small" /></IconButton>
        <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 12 }}><BotIcon sx={{ fontSize: 16 }} /></Avatar>
        <Box flex={1}>
          <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2}>Trợ lý FoxGo</Typography>
          <Typography variant="caption" sx={{ opacity: 0.85, fontSize: '0.68rem' }}>Hỗ trợ 24/7 · Trả lời tức thì</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} sx={{ color: '#fff' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.25, bgcolor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {aiMessages.map((msg, i) => <AIBubble key={i} msg={msg} />)}
        {aiLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 0.5 }}>
            <CircularProgress size={14} thickness={4} />
            <Typography variant="caption" color="text.secondary">Đang tìm câu trả lời...</Typography>
          </Box>
        )}
        <div ref={aiEndRef} />
      </Box>
      <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
        {!aiLoading && (
          <Box sx={{ px: 1.5, py: 0.85, bgcolor: '#f8fafc', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.68rem' }}>Gợi ý nhanh</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {FOXGO_QUICK_REPLIES.map((q) => (
                <Chip key={q} label={q} size="small" onClick={() => handleQuickReply(q)}
                  sx={{ fontSize: '0.72rem', height: 26, bgcolor: '#e8f0fe', color: '#1d4ed8', border: '1px solid #c7d7fb', cursor: 'pointer', '&:hover': { bgcolor: '#dbeafe' } }} />
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ px: 1.5, py: 1 }}>
          <TextField
            fullWidth size="small" multiline maxRows={3}
            placeholder="Nhập tin nhắn..." value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAiSend(); } }}
            disabled={aiLoading}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#f1f5f9', '& fieldset': { border: 'none' }, '&.Mui-focused fieldset': { border: '1.5px solid', borderColor: 'primary.main' } } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" color="primary" onClick={() => void handleAiSend()} disabled={!aiInput.trim() || aiLoading}
                    sx={{ bgcolor: 'primary.main', color: '#fff', width: 32, height: 32, '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }}>
                    <SendIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>
    </>
  );

  const customerPanel = (
    <>
      <Box sx={{ px: 1.5, py: 1.25, background: headerGradient, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setActiveTab('list')} sx={{ color: '#fff' }}><BackIcon fontSize="small" /></IconButton>
        <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 12 }}><CustomerIcon sx={{ fontSize: 16 }} /></Avatar>
        <Box flex={1}>
          <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2}>{customerName}</Typography>
          <Typography variant="caption" sx={{ opacity: 0.85, fontSize: '0.68rem' }}>
            {customerConnected ? '● Đang trực tuyến' : 'Đang kết nối...'}
          </Typography>
        </Box>
        {hasActiveRide && (
          <IconButton size="small" disabled={showCallPanel} onClick={() => { void startCall(); }}
            sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.08)' } }}
            title={`Gọi cho ${customerName}`}>
            <PhoneIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <IconButton size="small" onClick={handleClose} sx={{ color: '#fff' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      {showCallPanel ? (
        <RideCall
          embedded
          showIdleButton={false}
          callState={callState}
          callError={callError}
          contactName={customerName}
          onStart={() => void startCall()}
          onAccept={() => void acceptCall()}
          onHangUp={hangUp}
          onClose={handleClose}
        />
      ) : (
        <>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, py: 1.25, bgcolor: '#fff', display: 'flex', flexDirection: 'column' }}>
            {customerMessages.length === 0 && (
              <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary', py: 3 }}>
                <ForumRounded sx={{ fontSize: 36, opacity: 0.15, mb: 0.75 }} />
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Bắt đầu cuộc trò chuyện với khách hàng</Typography>
              </Box>
            )}
            {customerMessages.map((msg, i) => <CustomerBubble key={i} msg={msg} />)}
            {lastCallSummary && (
              <Box sx={{ alignSelf: 'center', my: 0.75, px: 1.5, py: 0.5, borderRadius: 999, bgcolor: '#eff6ff', color: '#1d4ed8', maxWidth: '90%', border: '1px solid #c7d7fb' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'center', display: 'block', fontSize: '0.72rem' }}>
                  📞 {lastCallSummary.text}
                </Typography>
              </Box>
            )}
            <div ref={customerEndRef} />
          </Box>
          <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fafbfc' }}>
            <TextField
              fullWidth size="small" multiline maxRows={3}
              placeholder="Nhập tin nhắn..." value={customerInput}
              onChange={(e) => setCustomerInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCustomerSend(); } }}
              disabled={!customerConnected}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#f1f5f9', '& fieldset': { border: 'none' }, '&.Mui-focused fieldset': { border: '1.5px solid', borderColor: 'primary.main' } } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" color="primary" onClick={handleCustomerSend} disabled={!customerConnected || !customerInput.trim()}
                      sx={{ bgcolor: 'primary.main', color: '#fff', width: 32, height: 32, '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }}>
                      <SendIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </>
      )}
    </>
  );

  return (
    <>
      <Fade in={open} timeout={200} unmountOnExit>
        <Paper elevation={16} sx={{
          position: 'fixed',
          bottom: { xs: 80, sm: 88 },
          right: { xs: 12, sm: 24 },
          width: { xs: 'calc(100vw - 24px)', sm: 380 },
          maxWidth: 400,
          height: { xs: 'calc(100dvh - 100px)', sm: 560 },
          maxHeight: 580,
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(148,163,184,0.18)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          zIndex: 1301,
          bgcolor: '#ffffff',
        }}>
          {activeTab === 'list' && conversationList}
          {activeTab === 'ai' && aiPanel}
          {activeTab === 'customer' && customerPanel}
        </Paper>
      </Fade>

      <Badge badgeContent={totalUnread} color="error" invisible={totalUnread === 0 || open} overlap="circular"
        sx={{ position: 'fixed', bottom: { xs: 16, sm: 24 }, right: { xs: 16, sm: 24 }, zIndex: 1300 }}>
        <Fab size="large" onClick={open ? handleClose : handleOpen}
          sx={{
            width: 60, height: 60,
            background: open
              ? 'linear-gradient(135deg, #475569, #64748b)'
              : 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
            color: '#fff',
            boxShadow: '0 6px 24px rgba(37,99,235,0.40)',
            transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)',
            transform: open ? 'rotate(90deg) scale(0.95)' : 'scale(1)',
            '&:hover': { transform: open ? 'rotate(90deg) scale(0.95)' : 'scale(1.06)' },
            ...(totalUnread > 0 && !open && {
              animation: 'pulse 1.8s ease-in-out infinite',
              '@keyframes pulse': {
                '0%,100%': { boxShadow: '0 6px 24px rgba(37,99,235,0.40)' },
                '50%': { boxShadow: '0 6px 32px rgba(37,99,235,0.70), 0 0 0 8px rgba(37,99,235,0.12)' },
              },
            }),
          }}
        >
          {open ? <CloseIcon sx={{ fontSize: 24 }} /> : <ForumRounded sx={{ fontSize: 26 }} />}
        </Fab>
      </Badge>
    </>
  );
};

export default AIAssistWidget;
