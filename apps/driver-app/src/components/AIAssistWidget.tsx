import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Badge,
  Box,
  Chip,
  CircularProgress,
  Fab,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
  Fade,
  Avatar,
} from '@mui/material';
import {
  SmartToy as BotIcon,
  Close as CloseIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { aiApi, ChatMessage } from '../api/ai.api';
import {
  FOXGO_AI_CHAT_TOP_K,
  FOXGO_AI_WELCOME_ASSISTANT,
  FOXGO_QUICK_REPLIES,
  miaOfflineFallbackReply,
} from '../config/foxgoAiUnified';

type AIMessage = { role: 'user' | 'assistant'; content: string; sources?: string[]; isError?: boolean };

const WELCOME: AIMessage = {
  role: 'assistant',
  content: FOXGO_AI_WELCOME_ASSISTANT,
};

function foxgoToChatHistory(messages: AIMessage[]): ChatMessage[] {
  return messages
    .filter((m) => !m.isError && m !== WELCOME)
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));
}

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

// ─── Main widget ────────────────────────────────────────────────────────────
const AIAssistWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([WELCOME]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUnread, setAiUnread] = useState(0);
  const aiEndRef = useRef<HTMLDivElement>(null);

  const headerGradient = 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)';

  // Auto-scroll
  useEffect(() => {
    if (open) {
      setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [aiMessages, open]);

  const handleOpen = () => {
    setOpen(true);
    setAiUnread(0);
  };
  const handleClose = () => setOpen(false);

  // ── AI send ──────────────────────────────────────────────────────────────
  const handleAiSend = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    setAiInput('');
    setAiUnread(0);
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
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              fb ||
              'Mình chưa nhận được câu trả lời từ máy chủ. Bạn thử lại sau vài giây nhé!',
            isError: !fb,
          },
        ]);
      }
    } catch {
      const fb = miaOfflineFallbackReply(text);
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            fb ||
            'Xin lỗi, mình đang gặp sự cố kỹ thuật. Vui lòng thử lại sau ít phút nhé!',
          isError: !fb,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, aiMessages]);

  const handleQuickReply = useCallback((text: string) => {
    setAiInput('');
    setAiUnread(0);
    const userMsg: AIMessage = { role: 'user', content: text };
    const conversation = [...aiMessages, userMsg];
    setAiMessages(conversation);
    setAiLoading(true);

    const history = foxgoToChatHistory(conversation);
    aiApi
      .chat({ message: text, history, top_k: FOXGO_AI_CHAT_TOP_K })
      .then(({ data }) => {
        const answer = (data.answer || '').trim();
        if (answer) {
          setAiMessages((prev) => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
        } else {
          const fb = miaOfflineFallbackReply(text);
          setAiMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                fb ||
                'Mình chưa nhận được câu trả lời từ máy chủ. Bạn thử lại sau vài giây nhé!',
              isError: !fb,
            },
          ]);
        }
      })
      .catch(() => {
        const fb = miaOfflineFallbackReply(text);
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              fb ||
              'Xin lỗi, mình đang gặp sự cố kỹ thuật. Vui lòng thử lại sau ít phút nhé!',
            isError: !fb,
          },
        ]);
      })
      .finally(() => setAiLoading(false));
  }, [aiMessages]);

  return (
    <>
      {/* Floating AI chat panel */}
      <Fade in={open} timeout={200} unmountOnExit>
        <Paper
          elevation={16}
          sx={{
            position: 'fixed',
            bottom: { xs: 220, sm: 164 },
            right: { xs: 12, sm: 24 },
            left: 'auto',
            width: { xs: 'calc(100vw - 24px)', sm: 360 },
            maxWidth: 380,
            height: { xs: 'calc(100dvh - 100px)', sm: 520 },
            maxHeight: 540,
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
          {/* Header */}
          <Box sx={{ px: 1.5, py: 1.25, background: headerGradient, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              <BotIcon sx={{ fontSize: 16 }} />
            </Avatar>
            <Box flex={1}>
              <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2}>Trợ lý FoxGo</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontSize: '0.68rem' }}>Mia · kho tri thức FoxGo</Typography>
            </Box>
            <IconButton size="small" onClick={handleClose} sx={{ color: '#fff' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Messages */}
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.68rem' }}>
                  Gợi ý nhanh
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {FOXGO_QUICK_REPLIES.map((q) => (
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
              </Box>
            )}
            <Box sx={{ px: 1.5, py: 1 }}>
            <TextField
              fullWidth size="small" multiline maxRows={3}
              placeholder="Nhập câu hỏi..." value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAiSend(); } }}
              disabled={aiLoading}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#f1f5f9', '& fieldset': { border: 'none' }, '&.Mui-focused fieldset': { border: '1.5px solid', borderColor: 'primary.main' } } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => void handleAiSend()}
                      disabled={!aiInput.trim() || aiLoading}
                      sx={{ bgcolor: 'primary.main', color: '#fff', width: 32, height: 32, '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' } }}
                    >
                      <SendIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            </Box>
          </Box>
        </Paper>
      </Fade>

      {/* FAB — bottom-right, stacked above ContactBox (60px FAB + gap) */}
      <Badge
        badgeContent={aiUnread}
        color="error"
        invisible={aiUnread === 0 || open}
        overlap="circular"
        sx={{ position: 'fixed', bottom: { xs: 152, sm: 96 }, right: { xs: 16, sm: 24 }, zIndex: 1300 }}
      >
        <Fab
          size="large"
          onClick={open ? handleClose : handleOpen}
          sx={{
            width: 56,
            height: 56,
            background: open
              ? 'linear-gradient(135deg, #475569, #64748b)'
              : 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
            color: '#fff',
            boxShadow: '0 6px 24px rgba(15,23,42,0.35)',
            transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)',
            transform: open ? 'rotate(15deg) scale(0.95)' : 'scale(1)',
            '&:hover': { transform: open ? 'rotate(15deg) scale(0.95)' : 'scale(1.06)' },
          }}
        >
          {open ? <CloseIcon sx={{ fontSize: 22 }} /> : <BotIcon sx={{ fontSize: 24 }} />}
        </Fab>
      </Badge>
    </>
  );
};

export default AIAssistWidget;
