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

// ─── Pattern matching ──────────────────────────────────────────────────────
const GREETING_RE = /^(hi+|hello+|hey+|xin chào|chào|alo|oi|ừ|ok|okay|bạn ơi|ơi|yo)\s*[!.]*$/i;
const GREETING_RESPONSES = [
  'Xin chào tài xế! Mình là trợ lý FoxGo, sẵn sàng hỗ trợ bạn 24/7. Bạn cần giúp gì ạ?',
  'Chào bạn! Bạn có thắc mắc gì về chuyến đi, thu nhập hay quy định không?',
  'Xin chào! Hãy cho mình biết mình có thể hỗ trợ gì cho bạn nhé?',
];
const THANKS_RE = /^(cảm ơn+|thanks+|thank you|ok cảm ơn|oke cảm ơn|cảm ơn bạn)\s*[!.]*$/i;
const THANKS_RESPONSES = [
  'Không có gì bạn ơi! Chúc bạn có chuyến đi an toàn và thu nhập tốt!',
  'Sẵn lòng hỗ trợ! Bạn cần thêm gì cứ hỏi mình nhé.',
];

interface QuickPattern { re: RegExp; answer: string }
const QUICK_PATTERNS: QuickPattern[] = [
  {
    re: /hoa hồng|commission|phí nền tảng|phần trăm|chiết khấu/i,
    answer: 'Tỷ lệ hoa hồng FoxGo:\n• Xe máy & xe ga: 20% trên mỗi cuốc\n• Ô tô 4 chỗ: 18%\n• Ô tô 7 chỗ: 15%\n\nVí dụ: cuốc 100.000đ bằng xe 4 chỗ → bạn nhận 82.000đ, FoxGo giữ 18.000đ.\nTiền về ví trong vòng 24 giờ sau khi hoàn thành chuyến.',
  },
  {
    re: /rating|đánh giá|sao|điểm số|tăng rating/i,
    answer: 'Cách duy trì & tăng rating:\n• Đến đón đúng giờ, thái độ thân thiện\n• Giữ xe sạch, điều hòa mát\n• Không hủy cuốc tùy tiện (ảnh hưởng tỉ lệ chấp nhận)\n• Rating tính trung bình 30 ngày gần nhất\n\nRating < 4.5 có thể bị hạn chế nhận cuốc vào giờ cao điểm.',
  },
  {
    re: /ký quỹ|đặt cọc|deposit|wallet|ví/i,
    answer: 'Ký quỹ tài xế FoxGo:\n• Số dư ví phải ≥ ngưỡng tối thiểu để nhận cuốc\n• Cuốc tiền mặt: bạn thu toàn bộ, hệ thống trừ phí vào ví sau\n• Nếu ví âm quá ngưỡng → không thể online nhận cuốc\n\nNạp tiền ký quỹ: vào mục "Ví" → "Nạp tiền".',
  },
  {
    re: /rút tiền|withdraw|rút ví/i,
    answer: 'Rút tiền từ ví FoxGo:\n1. Vào mục "Ví" → "Rút tiền"\n2. Nhập số tiền (tối thiểu 50.000đ)\n3. Chọn tài khoản ngân hàng đã liên kết\n4. Xác nhận\n\nThời gian xử lý: 1–2 ngày làm việc. Phí rút: miễn phí.',
  },
  {
    re: /hủy cuốc|từ chối|decline|cancel|chính sách hủy/i,
    answer: 'Chính sách hủy cuốc:\n• Hủy cuốc sau khi chấp nhận ảnh hưởng tỉ lệ hoàn thành\n• Tỉ lệ hoàn thành < 80% → ảnh hưởng điểm và khả năng nhận cuốc\n• Nên từ chối ngay khi điều phối nếu không thể nhận\n\nĐể hủy sau khi nhận: vào chuyến đang chạy → "Hủy chuyến".',
  },
  {
    re: /tai nạn|sự cố|accident|emergency|khẩn cấp/i,
    answer: 'Khi gặp sự cố hoặc tai nạn:\n1. Đảm bảo an toàn cho bản thân và hành khách trước\n2. Gọi 113/114/115 nếu cần cứu thương\n3. Báo FoxGo: hotline 1900-1234 (24/7)\n4. Chụp ảnh hiện trường nếu có thể\n\nFoxGo hỗ trợ giải quyết tranh chấp và bảo hiểm theo quy định.',
  },
  {
    re: /liên hệ|hỗ trợ|hotline|support|contact/i,
    answer: 'Liên hệ hỗ trợ tài xế FoxGo:\n• Hotline tài xế: 1900-1234 (8h–22h)\n• Email: driver-support@foxgo.vn\n• Chat trong app FoxGo Driver\n\nTrường hợp khẩn cấp: gọi hotline, đường dây ưu tiên cho tài xế.',
  },
  {
    re: /quy tắc|quy định|vận hành|điều khoản/i,
    answer: 'Quy tắc vận hành tài xế FoxGo:\n• Đón đúng điểm, không bắt khách ngoài app\n• Không từ chối cuốc phân biệt đối xử\n• Giữ vệ sinh xe, không hút thuốc khi có khách\n• Không sử dụng điện thoại khi lái xe\n• Mặc áo đồng phục FoxGo (khuyến khích)\n\nVi phạm nghiêm trọng có thể bị khóa tài khoản.',
  },
];

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const findQuickAnswer = (text: string): string | null => {
  const matched = QUICK_PATTERNS.find((p) => p.re.test(text));
  return matched ? matched.answer : null;
};

type AIMessage = { role: 'user' | 'assistant'; content: string; sources?: string[]; isError?: boolean };

const WELCOME: AIMessage = {
  role: 'assistant',
  content: 'Xin chào tài xế! Mình là trợ lý hỗ trợ FoxGo 🦊\nBạn cần tư vấn gì ạ? Chọn nhanh bên dưới hoặc nhập câu hỏi:',
};

const QUICK_REPLIES = [
  'Bảng hoa hồng',
  'Cách tăng rating',
  'Thanh toán ký quỹ',
  'Rút tiền ví',
  'Chính sách hủy cuốc',
  'Quy tắc vận hành',
  'Hỗ trợ tai nạn',
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
    setAiMessages((prev) => [...prev, userMsg]);
    setAiLoading(true);

    if (GREETING_RE.test(text)) {
      setTimeout(() => {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: pickRandom(GREETING_RESPONSES) }]);
        setAiLoading(false);
      }, 280);
      return;
    }
    if (THANKS_RE.test(text)) {
      setTimeout(() => {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: pickRandom(THANKS_RESPONSES) }]);
        setAiLoading(false);
      }, 280);
      return;
    }
    const quickAnswer = findQuickAnswer(text);
    if (quickAnswer) {
      setTimeout(() => {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: quickAnswer }]);
        setAiLoading(false);
      }, 400);
      return;
    }

    try {
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
    setAiInput('');
    setAiUnread(0);
    const userMsg: AIMessage = { role: 'user', content: text };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiLoading(true);

    const quickAnswer = findQuickAnswer(text);
    if (quickAnswer) {
      setTimeout(() => {
        setAiMessages((prev) => [...prev, { role: 'assistant', content: quickAnswer }]);
        setAiLoading(false);
      }, 400);
      return;
    }

    const history: ChatMessage[] = aiMessages
      .filter((m) => !m.isError && m !== WELCOME)
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
  }, [aiMessages]);

  return (
    <>
      {/* Floating AI chat panel */}
      <Fade in={open} timeout={200} unmountOnExit>
        <Paper
          elevation={16}
          sx={{
            position: 'fixed',
            bottom: { xs: 80, sm: 88 },
            left: { xs: 12, sm: 24 },
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
              <Typography variant="caption" sx={{ opacity: 0.85, fontSize: '0.68rem' }}>Hỗ trợ tài xế 24/7</Typography>
            </Box>
            <IconButton size="small" onClick={handleClose} sx={{ color: '#fff' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.25, bgcolor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {aiMessages.map((msg, i) => <AIBubble key={i} msg={msg} />)}
            {/* Quick reply chips — only on first open */}
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

          {/* Input */}
          <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
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
        </Paper>
      </Fade>

      {/* FAB trigger — bottom-left (ContactBox occupies bottom-right) */}
      <Badge
        badgeContent={aiUnread}
        color="error"
        invisible={aiUnread === 0 || open}
        overlap="circular"
        sx={{ position: 'fixed', bottom: { xs: 16, sm: 24 }, left: { xs: 16, sm: 24 }, zIndex: 1300 }}
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
