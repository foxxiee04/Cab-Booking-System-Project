import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Chip,
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
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  SmartToy as BotIcon,
  Close as CloseIcon,
  Send as SendIcon,
  ArrowBack as BackIcon,
  ForumRounded,
  DirectionsCar,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { aiApi, ChatMessage } from '../../api/ai.api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { closeMessenger } from '../../store/ui.slice';
import { useRideChat, ChatMessage as RideChatMessage } from '../../hooks/useRideChat';

// ─── Greeting detection ────────────────────────────────────────────────────
const GREETING_RE = /^(hi+|hello+|hey+|xin chào|chào|alo|oi|ừ|ok|okay|cảm ơn|thanks|thank you|bạn ơi|ơi|yo)\s*[!.]*$/i;
const GREETING_RESPONSES = [
  'Xin chào! Mình là trợ lý FoxGo, sẵn sàng hỗ trợ bạn 24/7. Bạn cần giúp gì ạ?',
  'Chào bạn! Mình là bot hỗ trợ của FoxGo. Bạn có thắc mắc gì về đặt xe, thanh toán hay tài khoản không?',
  'Xin chào! Rất vui được gặp bạn. Hãy cho mình biết mình có thể giúp gì cho bạn nhé?',
];
const THANKS_RE = /^(cảm ơn|thanks|thank you|ok cảm ơn|oke cảm ơn)\s*[!.]*$/i;
const THANKS_RESPONSES = [
  'Không có gì bạn ơi! Nếu cần hỗ trợ thêm, mình luôn ở đây nhé. 😊',
  'Vui lòng được giúp bạn! Chúc bạn có chuyến đi tuyệt vời.',
];

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

type AIMessage = { role: 'user' | 'assistant'; content: string; sources?: string[]; isError?: boolean };

const WELCOME: AIMessage = {
  role: 'assistant',
  content: 'Xin chào! Mình là trợ lý hỗ trợ FoxGo 🦊\nBạn cần tư vấn gì ạ? Chọn nhanh bên dưới hoặc nhập câu hỏi:',
};

const QUICK_REPLIES = [
  'Bảng giá xe máy',
  'Cách đặt xe',
  'Thanh toán MoMo/VNPay',
  'Voucher giảm giá',
  'Hủy chuyến mất phí không?',
  'Đăng ký tài xế',
  'Quên đồ trên xe',
  'Liên hệ hỗ trợ',
];

// ─── Bubble ────────────────────────────────────────────────────────────────
const AIBubble: React.FC<{ msg: AIMessage }> = ({ msg }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', mb: 1 }}>
    <Paper
      elevation={0}
      sx={{
        px: 1.75, py: 1,
        maxWidth: '82%',
        borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        bgcolor: msg.role === 'user' ? 'primary.main' : msg.isError ? '#fff3f3' : '#fff',
        color: msg.role === 'user' ? '#fff' : 'text.primary',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: '0.84rem' }}>
        {msg.content}
      </Typography>
    </Paper>
  </Box>
);

const DriverBubble: React.FC<{ msg: RideChatMessage }> = ({ msg }) => {
  const time = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return (
    <Stack direction="row" justifyContent={msg.isSelf ? 'flex-end' : 'flex-start'} sx={{ mb: 0.75 }}>
      {!msg.isSelf && (
        <Avatar sx={{ width: 24, height: 24, mr: 0.75, bgcolor: '#1d4ed8', fontSize: 10 }}>TX</Avatar>
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

// ─── Main widget ────────────────────────────────────────────────────────────
const AIChatWidget: React.FC = () => {
  const dispatch = useAppDispatch();
  const { accessToken } = useAppSelector((s) => s.auth);
  const { currentRide, driver } = useAppSelector((s) => s.ride);
  const { messengerOpenTo } = useAppSelector((s) => s.ui);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'ai' | 'driver'>('list');
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([WELCOME]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [driverInput, setDriverInput] = useState('');
  const [aiUnread, setAiUnread] = useState(0);
  const [driverUnread, setDriverUnread] = useState(0);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const driverEndRef = useRef<HTMLDivElement>(null);
  const prevDriverMsgCount = useRef(0);

  const hasActiveRide = Boolean(currentRide?.driverId && !['COMPLETED', 'CANCELLED'].includes(currentRide?.status || ''));
  const driverName = driver
    ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Tài xế'
    : 'Tài xế';

  const rideId = hasActiveRide ? currentRide?.id : null;
  const { messages: driverMessages, sendMessage: sendDriverMessage, connected: driverConnected } = useRideChat(
    hasActiveRide ? accessToken : null,
    rideId,
    undefined,
  );

  // Handle Redux openMessenger command
  useEffect(() => {
    if (messengerOpenTo) {
      setOpen(true);
      setActiveTab(messengerOpenTo);
      dispatch(closeMessenger());
    }
  }, [dispatch, messengerOpenTo]);

  // Auto-scroll
  useEffect(() => {
    if (activeTab === 'ai') setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [aiMessages, activeTab]);
  useEffect(() => {
    if (activeTab === 'driver') setTimeout(() => driverEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [driverMessages, activeTab]);

  // Unread counts
  useEffect(() => {
    if (!open || activeTab !== 'driver') {
      const newCount = driverMessages.length - prevDriverMsgCount.current;
      if (newCount > 0) setDriverUnread((p) => p + newCount);
    } else {
      setDriverUnread(0);
    }
    prevDriverMsgCount.current = driverMessages.length;
  }, [driverMessages.length, open, activeTab]);

  const handleOpen = () => {
    setOpen(true);
    setActiveTab('list');
  };
  const handleClose = () => setOpen(false);

  const handleTabSelect = (tab: 'ai' | 'driver') => {
    setActiveTab(tab);
    if (tab === 'ai') setAiUnread(0);
    if (tab === 'driver') setDriverUnread(0);
  };

  const totalUnread = aiUnread + driverUnread;

  // ── AI send ──────────────────────────────────────────────────────────────
  const handleAiSend = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    setAiInput('');
    const userMsg: AIMessage = { role: 'user', content: text };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiLoading(true);

    // Client-side greeting shortcut (fast response, no API call)
    if (GREETING_RE.test(text)) {
      setTimeout(() => {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: pickRandom(GREETING_RESPONSES) }]);
        setAiLoading(false);
      }, 300);
      return;
    }
    if (THANKS_RE.test(text)) {
      setTimeout(() => {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: pickRandom(THANKS_RESPONSES) }]);
        setAiLoading(false);
      }, 300);
      return;
    }

    try {
      // Exclude the static welcome message and error bubbles from history
      const history: ChatMessage[] = aiMessages
        .filter((m) => !m.isError && m !== WELCOME)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const { data } = await aiApi.chat({ message: text, history, top_k: 5 });
      setAiMessages((prev) => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
    } catch {
      setAiMessages((prev) => [...prev, { role: 'assistant', content: 'Xin lỗi, mình đang gặp sự cố kỹ thuật. Vui lòng thử lại sau ít phút nhé!', isError: true }]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, aiMessages]);

  const handleQuickReply = useCallback((text: string) => {
    setAiInput(text);
    // Trigger send immediately
    const userMsg: AIMessage = { role: 'user', content: text };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiLoading(true);
    const currentMessages = aiMessages.filter((m) => !m.isError && m !== WELCOME);
    const history: ChatMessage[] = currentMessages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    aiApi.chat({ message: text, history, top_k: 5 })
      .then(({ data }) => {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
      })
      .catch(() => {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: 'Xin lỗi, mình đang gặp sự cố kỹ thuật. Vui lòng thử lại sau ít phút nhé!', isError: true }]);
      })
      .finally(() => setAiLoading(false));
    setAiInput('');
  }, [aiMessages]);

  const handleDriverSend = () => {
    if (!driverInput.trim()) return;
    sendDriverMessage(driverInput);
    setDriverInput('');
  };

  const driverPhone = (driver as any)?.phoneNumber as string | undefined;
  const headerGradient = 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)';

  // ── Conversation list ────────────────────────────────────────────────────
  const conversationList = (
    <>
      <Box sx={{ px: 2, py: 1.5, background: headerGradient, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ForumRounded />
        <Typography variant="subtitle1" fontWeight={700} flex={1}>Tin nhắn</Typography>
        <IconButton size="small" onClick={handleClose} sx={{ color: '#fff' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <List disablePadding sx={{ flex: 1, overflow: 'auto' }}>
        {/* AI Bot conversation */}
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

        {/* Driver conversation — only when there's an active ride */}
        {hasActiveRide && (
          <ListItemButton onClick={() => handleTabSelect('driver')} sx={{ py: 1.5 }}>
            <ListItemAvatar>
              <Badge badgeContent={driverUnread} color="error" invisible={driverUnread === 0}>
                <Avatar sx={{ bgcolor: '#0ea5e9' }}><DirectionsCar fontSize="small" /></Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={<Typography variant="body2" fontWeight={700}>{driverName}</Typography>}
              secondary={
                <Typography variant="caption" color={driverConnected ? 'success.main' : 'text.secondary'} noWrap>
                  {driverConnected ? '● Đang trực tuyến' : 'Đang kết nối...'} · {driver?.vehicleModel || 'Tài xế của bạn'}
                </Typography>
              }
            />
          </ListItemButton>
        )}

        {!hasActiveRide && (
          <ListItem sx={{ py: 2 }}>
            <ListItemText
              secondary={<Typography variant="caption" color="text.secondary">Cuộc trò chuyện với tài xế sẽ xuất hiện khi bạn có chuyến đang hoạt động.</Typography>}
            />
          </ListItem>
        )}
      </List>
    </>
  );

  // ── AI chat panel ────────────────────────────────────────────────────────
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
        {/* Quick reply chips — show only on first open (just welcome message) */}
        {aiMessages.length === 1 && !aiLoading && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pl: 0.25, pt: 0.5 }}>
            {QUICK_REPLIES.map((q) => (
              <Chip
                key={q}
                label={q}
                size="small"
                onClick={() => handleQuickReply(q)}
                sx={{
                  fontSize: '0.72rem',
                  height: 26,
                  bgcolor: '#e8f0fe',
                  color: '#1d4ed8',
                  border: '1px solid #c7d7fb',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: '#dbeafe' },
                }}
              />
            ))}
          </Box>
        )}
        {aiLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 0.5 }}>
            <CircularProgress size={14} thickness={4} />
            <Typography variant="caption" color="text.secondary">Đang tìm câu trả lời...</Typography>
          </Box>
        )}
        <div ref={aiEndRef} />
      </Box>
      <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
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
    </>
  );

  // ── Driver chat panel ─────────────────────────────────────────────────────
  const driverPanel = (
    <>
      <Box sx={{ px: 1.5, py: 1.25, background: headerGradient, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setActiveTab('list')} sx={{ color: '#fff' }}><BackIcon fontSize="small" /></IconButton>
        <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 12 }}><DirectionsCar sx={{ fontSize: 16 }} /></Avatar>
        <Box flex={1}>
          <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2}>{driverName}</Typography>
          <Typography variant="caption" sx={{ opacity: 0.85, fontSize: '0.68rem' }}>
            {driverConnected ? '● Đang trực tuyến' : 'Đang kết nối...'}
          </Typography>
        </Box>
        {driverPhone && (
          <IconButton
            size="small"
            component="a"
            href={`tel:${driverPhone}`}
            sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' } }}
            title={`Gọi cho ${driverName}`}
          >
            <PhoneIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <IconButton size="small" onClick={handleClose} sx={{ color: '#fff' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, py: 1.25, bgcolor: '#fff', display: 'flex', flexDirection: 'column' }}>
        {driverMessages.length === 0 && (
          <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary', py: 3 }}>
            <ForumRounded sx={{ fontSize: 36, opacity: 0.15, mb: 0.75 }} />
            <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Bắt đầu cuộc trò chuyện với tài xế</Typography>
          </Box>
        )}
        {driverMessages.map((msg, i) => <DriverBubble key={i} msg={msg} />)}
        <div ref={driverEndRef} />
      </Box>
      <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fafbfc' }}>
        <TextField
          fullWidth size="small" multiline maxRows={3}
          placeholder="Nhập tin nhắn..." value={driverInput}
          onChange={(e) => setDriverInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDriverSend(); } }}
          disabled={!driverConnected}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#f1f5f9', '& fieldset': { border: 'none' }, '&.Mui-focused fieldset': { border: '1.5px solid', borderColor: 'primary.main' } } }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" color="primary" onClick={handleDriverSend} disabled={!driverConnected || !driverInput.trim()}
                  sx={{ bgcolor: 'primary.main', color: '#fff', width: 32, height: 32, '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }}>
                  <SendIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </>
  );

  return (
    <>
      {/* Floating chat panel */}
      <Fade in={open} timeout={200} unmountOnExit>
        <Paper
          elevation={16}
          sx={{
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
          }}
        >
          {activeTab === 'list' && conversationList}
          {activeTab === 'ai' && aiPanel}
          {activeTab === 'driver' && driverPanel}
        </Paper>
      </Fade>

      {/* FAB trigger — bottom-right */}
      <Badge
        badgeContent={totalUnread}
        color="error"
        invisible={totalUnread === 0 || open}
        overlap="circular"
        sx={{ position: 'fixed', bottom: { xs: 16, sm: 24 }, right: { xs: 16, sm: 24 }, zIndex: 1300 }}
      >
        <Fab
          size="large"
          onClick={open ? handleClose : handleOpen}
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

export default AIChatWidget;
