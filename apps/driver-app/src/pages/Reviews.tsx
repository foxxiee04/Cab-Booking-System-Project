import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Rating,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  ChatRounded,
  RateReviewRounded,
  StarRounded,
  TrendingUpRounded,
} from '@mui/icons-material';
import { driverApi } from '../api/driver.api';
import { reviewApi, DriverReview, DriverReviewStats } from '../api/review.api';
import { setProfile } from '../store/driver.slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const EMPTY_STATS: DriverReviewStats = {
  averageRating: 0,
  totalReviews: 0,
  ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const formatReviewDate = (value?: string) => {
  if (!value) {
    return 'Vừa xong';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Vừa xong';
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getReviewerLabel = (review: DriverReview) => (
  review.type === 'CUSTOMER_TO_DRIVER' ? 'Khách hàng' : (review.reviewerName?.trim() || 'Người đánh giá')
);

const getReviewerInitial = (review: DriverReview) => {
  if (review.type === 'CUSTOMER_TO_DRIVER') {
    return 'K';
  }

  const label = getReviewerLabel(review);
  return label[0]?.toUpperCase() || 'N';
};

const getRideCode = (rideId?: string) => (
  rideId ? `Chuyến #${rideId.slice(0, 8).toUpperCase()}` : 'Chuyến đi'
);

const getReviewMetaText = (review: DriverReview) => (
  `${getRideCode(review.rideId)} • ${formatReviewDate(review.createdAt)}`
);

const getTagLabel = (tag: string) => {
  const labels: Record<string, string> = {
    auto_rated: 'Tự động 5 sao',
    excellent: 'Tuyệt vời',
    safe_driving: 'Lái xe an toàn',
    friendly: 'Thân thiện',
    on_time: 'Đúng giờ',
    clean_car: 'Xe sạch sẽ',
    good_service: 'Dịch vụ tốt',
    careful_driving: 'Lái cẩn thận',
    good_attitude: 'Thái độ tốt',
    correct_route: 'Đúng tuyến đường',
    average: 'Bình thường',
    needs_improvement: 'Cần cải thiện',
    slightly_late: 'Hơi trễ',
    careless_driving: 'Lái chưa cẩn thận',
    poor_attitude: 'Thái độ chưa tốt',
    unclean_car: 'Xe chưa sạch',
    late: 'Đến muộn',
    unsafe_driving: 'Lái không an toàn',
    bad_attitude: 'Thái độ không tốt',
    dirty_car: 'Xe không sạch',
    very_late: 'Đến rất muộn',
    wrong_route: 'Sai tuyến đường',
  };

  return labels[tag] || tag;
};

const Reviews: React.FC = () => {
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((state) => state.driver);

  const [reviews, setReviews] = useState<DriverReview[]>([]);
  const [stats, setStats] = useState<DriverReviewStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let driverProfile = profile;
      if (!driverProfile?.id) {
        const profileResponse = await driverApi.getProfile();
        driverProfile = profileResponse.data.driver;
        dispatch(setProfile(driverProfile));
      }

      const driverId = driverProfile?.id;
      if (!driverId) {
        setReviews([]);
        setStats(EMPTY_STATS);
        return;
      }

      const [reviewsResponse, statsResponse] = await Promise.all([
        reviewApi.getReceivedReviews(driverId, 100),
        reviewApi.getDriverStats(driverId),
      ]);

      const customerReviews = (reviewsResponse.reviews || [])
        .filter((review) => review.type === 'CUSTOMER_TO_DRIVER');
      setReviews(customerReviews);
      setStats(statsResponse.stats || EMPTY_STATS);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Không thể tải đánh giá của bạn.');
    } finally {
      setLoading(false);
    }
  }, [dispatch, profile]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const averageRating = stats.totalReviews > 0 ? stats.averageRating : 0;
  const latestPositive = useMemo(
    () => reviews.find((review) => review.rating >= 4 && review.comment?.trim()),
    [reviews],
  );

  return (
    <Box
      sx={{
        minHeight: '100%',
        pb: 2,
        background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
      }}
    >
      <Stack spacing={1.5}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 5,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(14,165,233,0.14))',
            border: '1px solid rgba(148, 163, 184, 0.18)',
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ p: 1.25, borderRadius: 3, bgcolor: 'rgba(245,158,11,0.14)', display: 'flex' }}>
              <RateReviewRounded sx={{ color: '#b45309', fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={900}>
                Đánh giá của tôi
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nhận xét từ khách hàng sau các chuyến đã hoàn thành
              </Typography>
            </Box>
          </Stack>

          {loading ? (
            <Stack spacing={1.5}>
              <Skeleton variant="rounded" height={92} sx={{ borderRadius: 3 }} />
              <Skeleton variant="rounded" height={108} sx={{ borderRadius: 3 }} />
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 1.25 }}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#fff' }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <StarRounded sx={{ color: '#f59e0b' }} />
                    <Typography variant="h4" fontWeight={900}>
                      {stats.totalReviews ? averageRating.toFixed(1) : '--'}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Điểm trung bình
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#fff' }}>
                  <Typography variant="h4" fontWeight={900}>
                    {stats.totalReviews}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Lượt đánh giá
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#fff', gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <TrendingUpRounded sx={{ color: '#16a34a' }} />
                    <Typography variant="h4" fontWeight={900}>
                      {reviews.filter((review) => review.rating >= 4).length}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Đánh giá tích cực
                  </Typography>
                </Paper>
              </Box>

              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#fff' }}>
                <Stack spacing={1}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = stats.ratingDistribution?.[star] || 0;
                    const percent = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                    return (
                      <Stack key={star} direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" sx={{ width: 42, fontWeight: 800 }}>
                          {star} sao
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={percent}
                          sx={{
                            flex: 1,
                            height: 8,
                            borderRadius: 99,
                            bgcolor: '#e2e8f0',
                            '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: star >= 4 ? '#f59e0b' : '#64748b' },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ width: 28, textAlign: 'right' }}>
                          {count}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Paper>

              {latestPositive && (
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <Typography variant="caption" fontWeight={800} color="success.dark">
                    Nhận xét nổi bật
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.75, color: '#14532d' }}>
                    {latestPositive.comment}
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}
        </Paper>

        {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}

        {loading && (
          <Stack spacing={1.25}>
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} variant="rounded" height={112} sx={{ borderRadius: 3 }} />
            ))}
          </Stack>
        )}

        {!loading && reviews.length === 0 && !error && (
          <Box sx={{ py: 6, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <ChatRounded sx={{ fontSize: 32, color: 'text.disabled' }} />
            </Box>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              Chưa có đánh giá nào
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Khi khách hàng đánh giá chuyến đi, nhận xét sẽ xuất hiện tại đây.
            </Typography>
          </Box>
        )}

        {!loading && reviews.length > 0 && (
          <Stack spacing={1.25}>
            {reviews.map((review) => (
              <Card key={review._id || `${review.rideId}-${review.createdAt || review.rating}`} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        bgcolor: '#eff6ff',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {getReviewerInitial(review)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight={900} noWrap>
                            {getReviewerLabel(review)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getReviewMetaText(review)}
                          </Typography>
                        </Box>
                        <Chip size="small" label={`${review.rating} sao`} color={review.rating >= 4 ? 'warning' : 'default'} sx={{ fontWeight: 800 }} />
                      </Stack>

                      <Rating value={review.rating} readOnly size="small" sx={{ mt: 0.75 }} />

                      {review.comment?.trim() ? (
                        <Typography variant="body2" sx={{ mt: 0.75 }}>
                          {review.comment}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontStyle: 'italic' }}>
                          Khách hàng không để lại nhận xét.
                        </Typography>
                      )}

                      {review.tags && review.tags.length > 0 && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            {review.tags.map((tag) => (
                              <Chip key={tag} size="small" label={getTagLabel(tag)} variant="outlined" />
                            ))}
                          </Stack>
                        </>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default Reviews;
