import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  ChatBubbleRounded,
  CheckCircleRounded,
  DirectionsCarRounded,
} from '@mui/icons-material';
import { useAppSelector } from '../store/hooks';
import { Ride } from '../types';
import axiosInstance from '../api/axios.config';
import RideChat from '../components/RideChat';
import { useTranslation } from 'react-i18next';

const formatRideDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const getCustomerName = (ride: Ride) =>
  ride.customer
    ? `${ride.customer.firstName} ${ride.customer.lastName}`.trim() || 'Khách hàng'
    : 'Khách hàng';

const Messages: React.FC = () => {
  const { t } = useTranslation();
  const { currentRide } = useAppSelector((state) => state.ride);
  const { user, accessToken } = useAppSelector((state) => state.auth);

  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatRide, setActiveChatRide] = useState<Ride | null>(null);

  const fetchRecentRides = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await axiosInstance.get('/rides/driver/history', {
        params: { status: 'COMPLETED', limit: 20 },
      });
      const rides: Ride[] = resp.data?.data?.rides || [];
      setRecentRides(rides);
    } catch {
      setRecentRides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecentRides();
  }, [fetchRecentRides]);

  const openChat = (ride: Ride) => {
    setActiveChatRide(ride);
    setChatOpen(true);
  };

  const isActiveRide = (ride: Ride) => currentRide?.id === ride.id;

  return (
    <Box sx={{ pb: 3 }}>
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2 }}>
        {t('messages.title', 'Tin nhắn')}
      </Typography>

      {/* Active ride chat banner */}
      {currentRide && (
        <Card
          sx={{
            mb: 2,
            borderRadius: 4,
            background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
            color: '#fff',
            cursor: 'pointer',
          }}
          onClick={() => openChat(currentRide)}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 44, height: 44 }}>
                <DirectionsCarRounded />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="overline" sx={{ opacity: 0.8, lineHeight: 1.2, display: 'block' }}>
                  Cuộc hội thoại đang diễn ra
                </Typography>
                <Typography variant="subtitle1" fontWeight={800}>
                  {getCustomerName(currentRide)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }} noWrap>
                  {currentRide.pickupLocation?.address || 'Điểm đón đang cập nhật'}
                </Typography>
              </Box>
              <Chip
                size="small"
                label="Nhắn tin"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* No active ride info */}
      {!currentRide && (
        <Alert severity="info" icon={<ChatBubbleRounded />} sx={{ mb: 2, borderRadius: 3 }}>
          {t('messages.noActiveRide', 'Chưa có chuyến đang diễn ra. Tin nhắn với khách hàng sẽ xuất hiện khi bạn nhận chuyến.')}
        </Alert>
      )}

      {/* Recent conversations */}
      <Card variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 1.75, background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '1px solid #e2e8f0' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={800}>
              {t('messages.recentChats', 'Cuộc hội thoại gần đây')}
            </Typography>
            <ChatBubbleRounded color="primary" sx={{ fontSize: 20 }} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('messages.recentChatsBody', 'Nhấn để xem lại lịch sử nhắn tin trong từng chuyến')}
          </Typography>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!loading && recentRides.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <ChatBubbleRounded sx={{ fontSize: 40, opacity: 0.15, mb: 1 }} />
            <Typography variant="body2">
              {t('messages.noChats', 'Chưa có cuộc hội thoại nào')}
            </Typography>
          </Box>
        )}

        {!loading && recentRides.length > 0 && (
          <List disablePadding>
            {recentRides.map((ride, idx) => {
              const isActive = isActiveRide(ride);
              const customerName = getCustomerName(ride);
              const initials = customerName.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();

              return (
                <React.Fragment key={ride.id}>
                  {idx > 0 && <Divider />}
                  <ListItem disablePadding>
                    <ListItemButton
                      sx={{ px: 2, py: 1.25 }}
                      onClick={() => openChat(ride)}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: isActive ? 'primary.main' : '#dbeafe',
                            color: isActive ? '#fff' : '#1d4ed8',
                            width: 44,
                            height: 44,
                            fontWeight: 700,
                          }}
                        >
                          {initials || 'KH'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Typography variant="body1" fontWeight={700} noWrap sx={{ flex: 1 }}>
                              {customerName}
                            </Typography>
                            {isActive && (
                              <Chip size="small" label="Đang chạy" color="primary" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }} />
                            )}
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={0.2}>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {ride.pickupLocation?.address || 'Điểm đón'}
                              {' → '}
                              {ride.dropoffLocation?.address || 'Điểm đến'}
                            </Typography>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <CheckCircleRounded sx={{ fontSize: 12, color: 'success.main' }} />
                              <Typography variant="caption" color="text.secondary">
                                {formatRideDate(ride.completedAt || ride.createdAt)}
                              </Typography>
                            </Stack>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Card>

      {/* Chat Drawer */}
      {activeChatRide && (
        <RideChat
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          token={accessToken}
          rideId={activeChatRide.id}
          myUserId={user?.id}
          driverName={getCustomerName(activeChatRide)}
        />
      )}
    </Box>
  );
};

export default Messages;
