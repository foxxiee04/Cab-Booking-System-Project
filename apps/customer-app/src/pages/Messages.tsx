import React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  ChatBubbleOutlineRounded,
  HeadsetMicRounded,
  LocalOfferRounded,
  SupportAgentRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import { getRideStatusLabel } from '../utils/format.utils';

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentRide } = useAppSelector((state) => state.ride);

  const conversations = [
    {
      id: 'support',
      title: t('messages.support', 'Trung tâm hỗ trợ'),
      subtitle: t('messages.supportBody', 'Giải đáp về thanh toán, hoàn tiền và sự cố chuyến đi.'),
      icon: <SupportAgentRounded />,
      badge: t('messages.online', 'Online'),
    },
    {
      id: 'promo',
      title: t('messages.promo', 'Ưu đãi hôm nay'),
      subtitle: t('messages.promoBody', 'Mã giảm giá cho chuyến giờ cao điểm và các tuyến đi sân bay.'),
      icon: <LocalOfferRounded />,
      badge: t('messages.new', 'Mới'),
    },
  ];

  return (
    <Box sx={{ height: '100%', overflow: 'auto', pb: 2 }}>
      <Stack spacing={2}>
        {currentRide ? (
          <Card sx={{ borderRadius: 5, background: 'linear-gradient(135deg, #0f172a, #1d4ed8)', color: '#fff' }}>
            <CardContent>
              <Typography variant="overline" sx={{ opacity: 0.8 }}>
                {t('messages.liveChannel', 'Kênh chuyến đi hiện tại')}
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5 }}>
                {t('messages.driverChatLocked', 'Chat trực tiếp sẽ mở khi tài xế nhận chuyến')}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.86 }}>
                {t('messages.driverChatBody', 'Hiện tại app đã hiển thị kênh hội thoại. Khi frontend chat realtime được bật, luồng này sẽ gắn trực tiếp với ride đang hoạt động.')}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Chip label={getRideStatusLabel(currentRide.status)} color="primary" variant="filled" />
                <Chip label={currentRide.id.slice(0, 8)} variant="outlined" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.28)' }} />
              </Stack>
              <Button
                variant="contained"
                color="inherit"
                sx={{ mt: 2, borderRadius: 3, color: 'primary.main', fontWeight: 800 }}
                onClick={() => navigate(`/ride/${currentRide.id}`)}
              >
                {t('messages.openRide', 'Mở màn hình chuyến đi')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            {t('messages.noActiveRide', 'Chưa có chuyến đang hoạt động. Khi tài xế nhận chuyến, mục chat và hỗ trợ sẽ xuất hiện ở đây.')}
          </Alert>
        )}

        <Card sx={{ borderRadius: 5 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  {t('messages.inbox', 'Hộp thư dịch vụ')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('messages.inboxBody', 'Giao diện đã được tổ chức theo kiểu super-app để sẵn sàng gắn chat realtime và thông báo điều hành.')}
                </Typography>
              </Box>
              <ChatBubbleOutlineRounded color="primary" />
            </Stack>

            <List disablePadding>
              {conversations.map((conversation) => (
                <ListItem key={conversation.id} disableGutters sx={{ py: 1.25 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#dbeafe', color: '#1d4ed8' }}>{conversation.icon}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={conversation.title}
                    secondary={conversation.subtitle}
                    primaryTypographyProps={{ fontWeight: 700 }}
                  />
                  <Chip label={conversation.badge} size="small" color="primary" variant="outlined" />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 5 }}>
          <CardContent>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
              <HeadsetMicRounded color="primary" />
              <Typography variant="subtitle1" fontWeight={800}>
                {t('messages.helpCenter', 'Cần hỗ trợ ngay?')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('messages.helpCenterBody', 'Bạn có thể chuyển sang trang Hồ sơ để xem trung tâm trợ giúp, cài đặt tài khoản và thông tin thanh toán.')}
            </Typography>
            <Button variant="outlined" sx={{ borderRadius: 3 }} onClick={() => navigate('/profile')}>
              {t('messages.goProfile', 'Đến Tài khoản')}
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default Messages;