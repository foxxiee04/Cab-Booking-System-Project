import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Fab,
  Drawer,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  Chip,
  Avatar,
  Paper,
} from '@mui/material';
import {
  SmartToy as BotIcon,
  Close as CloseIcon,
  Send as SendIcon,
  SupportAgent as SupportIcon,
} from '@mui/icons-material';
import { aiApi, ChatMessage } from '../../api/ai.api';

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  isError?: boolean;
}

const WELCOME_MESSAGE: DisplayMessage = {
  role: 'assistant',
  content:
    'Xin chào! Tôi là trợ lý hỗ trợ của CabBooking. Tôi có thể giúp bạn về:\n• Cách đặt xe\n• Bảng giá và phí dịch vụ\n• Thanh toán & ví\n• Voucher & khuyến mãi\n• Đăng ký tài xế\n• Hỗ trợ & an toàn\n\nBạn cần tư vấn gì?',
  sources: [],
};

const AIChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, open]);

  const buildHistory = (): ChatMessage[] =>
    messages
      .filter((m) => !m.isError)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    const userMsg: DisplayMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = buildHistory();
      const { data } = await aiApi.chat({ message: text, history, top_k: 4 });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.',
          isError: true,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* FAB trigger */}
      <Fab
        color="primary"
        aria-label="Trợ lý AI"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 80,
          left: 16,
          zIndex: 1200,
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          boxShadow: '0 4px 20px rgba(25, 118, 210, 0.45)',
          '&:hover': {
            background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
          },
        }}
      >
        <SupportIcon />
      </Fab>

      {/* Chat drawer */}
      <Drawer
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 380 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 36, height: 36 }}>
            <BotIcon fontSize="small" />
          </Avatar>
          <Box flex={1}>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
              Trợ lý CabBooking
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Hỗ trợ 24/7 · Trả lời tức thì
            </Typography>
          </Box>
          <IconButton
            onClick={() => setOpen(false)}
            size="small"
            sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Message list */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2,
            py: 1.5,
            bgcolor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  px: 1.75,
                  py: 1.25,
                  maxWidth: '85%',
                  borderRadius: msg.role === 'user'
                    ? '18px 18px 4px 18px'
                    : '18px 18px 18px 4px',
                  bgcolor: msg.role === 'user'
                    ? 'primary.main'
                    : msg.isError
                      ? '#fff3f3'
                      : '#fff',
                  color: msg.role === 'user' ? '#fff' : 'text.primary',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  border: msg.isError ? '1px solid #fca5a5' : 'none',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}
                >
                  {msg.content}
                </Typography>
              </Paper>

              {/* Sources */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {msg.sources.map((src, si) => (
                    <Chip
                      key={si}
                      label={src}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        borderColor: '#bfdbfe',
                        color: '#1d4ed8',
                        bgcolor: '#eff6ff',
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} thickness={4} />
              <Typography variant="caption" color="text.secondary">
                Đang tìm kiếm...
              </Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input bar */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: '#fff',
            display: 'flex',
            gap: 1,
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Nhập câu hỏi của bạn..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                bgcolor: '#f1f5f9',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: '1.5px solid', borderColor: 'primary.main' },
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            sx={{
              bgcolor: 'primary.main',
              color: '#fff',
              width: 40,
              height: 40,
              flexShrink: 0,
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      </Drawer>
    </>
  );
};

export default AIChatWidget;
