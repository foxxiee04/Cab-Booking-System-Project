import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ChatBubbleRounded, Close, Send, WifiOff } from '@mui/icons-material';
import { ChatMessage, useRideChat } from '../hooks/useRideChat';

interface RideChatProps {
  open: boolean;
  onClose: () => void;
  token: string | null | undefined;
  rideId: string | null | undefined;
  myUserId?: string | null;
  driverName?: string;
}

const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const isSelf = msg.isSelf;
  const time = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <Stack direction="row" justifyContent={isSelf ? 'flex-end' : 'flex-start'} sx={{ mb: 1 }}>
      {!isSelf && (
        <Avatar sx={{ width: 28, height: 28, mr: 1, bgcolor: '#1d4ed8', fontSize: 12 }}>
          {msg.role === 'DRIVER' ? 'TX' : 'KH'}
        </Avatar>
      )}
      <Box
        sx={{
          maxWidth: '72%',
          px: 1.5,
          py: 0.75,
          borderRadius: isSelf ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          bgcolor: isSelf ? '#1d4ed8' : '#f1f5f9',
          color: isSelf ? '#fff' : 'text.primary',
        }}
      >
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {msg.message}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.65, display: 'block', textAlign: 'right', mt: 0.25 }}>
          {time}
        </Typography>
      </Box>
    </Stack>
  );
};

const RideChat: React.FC<RideChatProps> = ({ open, onClose, token, rideId, myUserId, driverName }) => {
  const { messages, sendMessage, connected } = useRideChat(token, rideId, myUserId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, open]);

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

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 380, md: 420 },
          borderTopLeftRadius: { xs: 24, sm: 28 },
          borderBottomLeftRadius: { xs: 0, sm: 28 },
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid rgba(148,163,184,0.18)',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <ChatBubbleRounded color="primary" fontSize="small" />
        <Stack sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={800}>
            Nhắn tin {driverName ? `với ${driverName}` : ''}
          </Typography>
          {connected ? (
            <Typography variant="caption" color="success.main">Đang kết nối</Typography>
          ) : (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <WifiOff sx={{ fontSize: 12 }} color="error" />
              <Typography variant="caption" color="error">Đang kết nối lại...</Typography>
            </Stack>
          )}
        </Stack>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', py: 2, px: 2 }}>
        {messages.length === 0 && (
          <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary' }}>
            <ChatBubbleRounded sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
            <Typography variant="body2">
              Chưa có tin nhắn nào. Bắt đầu cuộc trò chuyện!
            </Typography>
          </Box>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </Box>

      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Nhập tin nhắn..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!connected}
          multiline
          maxRows={3}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleSend}
                  disabled={!connected || !input.trim()}
                >
                  {connected ? <Send fontSize="small" /> : <CircularProgress size={16} />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Drawer>
  );
};

export default RideChat;
