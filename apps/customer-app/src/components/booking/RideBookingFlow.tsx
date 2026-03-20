import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  AccountBalanceWallet,
  AirportShuttle,
  CreditCard,
  DirectionsCar,
  LocalTaxi,
  MoneyOff,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { formatCurrency } from '../../utils/format.utils';
import { formatDistance } from '../../utils/map.utils';
import { pricingApi } from '../../api/pricing.api';
import { rideApi } from '../../api/ride.api';
import { Location } from '../../types';

interface RideBookingFlowProps {
  open: boolean;
  onClose: () => void;
  pickup: Location;
  dropoff: Location;
  onRideCreated: (rideId: string) => void;
  presentation?: 'modal' | 'inline';
}

interface PriceEstimate {
  fare: number;
  distance: number;
  duration: number;
  surgeMultiplier: number;
}

interface VehicleOption {
  type: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  name: string;
  icon: React.ReactNode;
  description: string;
  capacity: number;
  priceMultiplier: number;
}

const vehicleOptions: VehicleOption[] = [
  {
    type: 'ECONOMY',
    name: 'Phổ thông',
    icon: <DirectionsCar fontSize="large" />,
    description: 'Tiết kiệm, dễ đặt',
    capacity: 4,
    priceMultiplier: 1.0,
  },
  {
    type: 'COMFORT',
    name: 'Tiện nghi',
    icon: <LocalTaxi fontSize="large" />,
    description: 'Thoải mái hơn',
    capacity: 4,
    priceMultiplier: 1.3,
  },
  {
    type: 'PREMIUM',
    name: 'Cao cấp',
    icon: <AirportShuttle fontSize="large" />,
    description: 'Không gian rộng, trải nghiệm tốt hơn',
    capacity: 6,
    priceMultiplier: 1.8,
  },
];

const paymentOptions = [
  { method: 'CASH', label: 'Tiền mặt', icon: <MoneyOff /> },
  { method: 'CARD', label: 'Thẻ', icon: <CreditCard /> },
  { method: 'WALLET', label: 'Ví điện tử', icon: <AccountBalanceWallet /> },
];

const VEHICLE_FETCH_ORDER: Array<'ECONOMY' | 'COMFORT' | 'PREMIUM'> = ['ECONOMY', 'COMFORT', 'PREMIUM'];

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 5000): Promise<T> => {
  let timeoutHandle: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = window.setTimeout(() => {
      reject(new Error('Hệ thống đang phản hồi chậm. Vui lòng thử lại.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      window.clearTimeout(timeoutHandle);
    }
  }
};

const RideBookingFlow: React.FC<RideBookingFlowProps> = ({
  open,
  onClose,
  pickup,
  dropoff,
  onRideCreated,
  presentation = 'modal',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStep, setActiveStep] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<'ECONOMY' | 'COMFORT' | 'PREMIUM'>('ECONOMY');
  const [selectedPayment, setSelectedPayment] = useState<'CASH' | 'CARD' | 'WALLET'>('CASH');
  const [priceEstimates, setPriceEstimates] = useState<Record<string, PriceEstimate>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const estimateRequestIdRef = useRef(0);
  const pickupLat = pickup?.lat;
  const pickupLng = pickup?.lng;
  const pickupAddress = pickup?.address;
  const dropoffLat = dropoff?.lat;
  const dropoffLng = dropoff?.lng;
  const dropoffAddress = dropoff?.address;

  const steps = ['Chọn xe', 'Thanh toán', 'Xác nhận'];

  const fetchEstimate = useCallback(async (vehicleType: 'ECONOMY' | 'COMFORT' | 'PREMIUM') => {
    const response = await withTimeout(
      pricingApi.estimateFare({
        pickup: {
          lat: pickupLat,
          lng: pickupLng,
          address: pickupAddress,
        },
        dropoff: {
          lat: dropoffLat,
          lng: dropoffLng,
          address: dropoffAddress,
        },
        vehicleType,
      })
    );

    return {
      fare: response.data.fare,
      distance: response.data.distance,
      duration: response.data.duration,
      surgeMultiplier: response.data.surgeMultiplier || 1.0,
    };
  }, [dropoffAddress, dropoffLat, dropoffLng, pickupAddress, pickupLat, pickupLng]);

  const fetchPriceEstimates = useCallback(async () => {
    const requestId = estimateRequestIdRef.current + 1;
    estimateRequestIdRef.current = requestId;

    setLoading(true);
    setLoadingMore(false);
    setError('');
    setPriceEstimates({});

    try {
      const primaryVehicle: 'ECONOMY' | 'COMFORT' | 'PREMIUM' = 'ECONOMY';
      const primaryEstimate = await fetchEstimate(primaryVehicle);

      if (estimateRequestIdRef.current !== requestId) {
        return;
      }

      setPriceEstimates({ [primaryVehicle]: primaryEstimate });
      setSelectedVehicle(primaryVehicle);
      setActiveStep(0); // Start at vehicle selection step

      setLoadingMore(true);
      const remainingVehicles = VEHICLE_FETCH_ORDER.filter((vehicleType) => vehicleType !== primaryVehicle);

      for (const vehicleType of remainingVehicles) {
        if (estimateRequestIdRef.current !== requestId) {
          return;
        }

        try {
          const estimate = await fetchEstimate(vehicleType);

          if (estimateRequestIdRef.current !== requestId) {
            return;
          }

          setPriceEstimates((prev) => ({ ...prev, [vehicleType]: estimate }));
        } catch {
          // Keep the flow usable even if a secondary estimate fails.
        }
      }
    } catch (err: any) {
      if (estimateRequestIdRef.current === requestId) {
        setError(err.response?.data?.error?.message || err.message || 'Không thể tải giá cước dự kiến');
      }
    } finally {
      if (estimateRequestIdRef.current === requestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [fetchEstimate]);

  useEffect(() => {
    if (open && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      fetchPriceEstimates();
    }
  }, [dropoffLat, dropoffLng, fetchPriceEstimates, open, pickupLat, pickupLng]);

  useEffect(() => {
    if (!open) {
      estimateRequestIdRef.current += 1;
    }
  }, [open]);

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleConfirmBooking = async () => {
    setCreating(true);
    setError('');

    try {
      const response = await rideApi.createRide({
        pickup,
        dropoff,
        vehicleType: selectedVehicle,
        paymentMethod: selectedPayment,
      });

      onRideCreated(response.data.ride.id);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tạo chuyến xe');
    } finally {
      setCreating(false);
    }
  };

  const selectedEstimate = priceEstimates[selectedVehicle];

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Vehicle Selection
        return (
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={800}>
              Chọn loại xe phù hợp
            </Typography>
            {loadingMore && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Đang tải thêm giá cho các loại xe còn lại. Bạn vẫn có thể tiếp tục với lựa chọn hiện tại.
              </Alert>
            )}
            <Grid container spacing={2}>
              {vehicleOptions.map((vehicle) => {
                const estimate = priceEstimates[vehicle.type];
                return (
                  <Grid item xs={12} key={vehicle.type}>
                    <Card
                      variant={selectedVehicle === vehicle.type ? 'elevation' : 'outlined'}
                      sx={{
                        cursor: estimate ? 'pointer' : 'not-allowed',
                        opacity: estimate ? 1 : 0.68,
                        border: selectedVehicle === vehicle.type ? 2 : 1,
                        borderColor: selectedVehicle === vehicle.type ? 'primary.main' : 'divider',
                        borderRadius: 4,
                        boxShadow: selectedVehicle === vehicle.type ? '0 10px 28px rgba(37,99,235,0.18)' : undefined,
                      }}
                      onClick={() => {
                        if (estimate) {
                          setSelectedVehicle(vehicle.type);
                        }
                      }}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={2}>
                            <Box color="primary.main">{vehicle.icon}</Box>
                            <Box>
                              <Typography variant="h6" fontWeight={800}>{vehicle.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {vehicle.description} • {vehicle.capacity} chỗ
                              </Typography>
                              {estimate && (
                                <Typography variant="caption" color="text.secondary">
                                  {formatDistance(estimate.distance)} • ~
                                  {Math.round(estimate.duration / 60)} min
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Box textAlign="right">
                            {estimate ? (
                              <>
                                <Typography variant="h6" color="primary">
                                  {formatCurrency(estimate.fare)}
                                </Typography>
                                {estimate.surgeMultiplier > 1 && (
                                  <Chip
                                    size="small"
                                    label={`Tăng giá ${estimate.surgeMultiplier}x`}
                                    color="error"
                                  />
                                )}
                              </>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Tạm thời chưa có giá
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );

      case 1: // Payment Method
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Phương thức thanh toán
            </Typography>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value as any)}
              >
                {paymentOptions.map((option) => (
                  <Card
                    key={option.method}
                    variant="outlined"
                    sx={{ mb: 2, cursor: 'pointer', borderRadius: 4 }}
                    onClick={() => setSelectedPayment(option.method as any)}
                  >
                    <CardContent>
                      <FormControlLabel
                        value={option.method}
                        control={<Radio />}
                        label={
                          <Box display="flex" alignItems="center" gap={2}>
                            {option.icon}
                            <Typography>{option.label}</Typography>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                ))}
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 2: // Confirmation
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Xác nhận chuyến đi
            </Typography>
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent>
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Điểm đón
                  </Typography>
                  <Typography>{pickup.address || 'Điểm đã chọn'}</Typography>
                </Box>
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Điểm đến
                  </Typography>
                  <Typography>{dropoff.address || 'Điểm đã chọn'}</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Loại xe</Typography>
                  <Typography fontWeight="bold">
                    {vehicleOptions.find((v) => v.type === selectedVehicle)?.name}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Thanh toán</Typography>
                  <Typography fontWeight="bold">
                    {paymentOptions.find((p) => p.method === selectedPayment)?.label}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="h6">Tổng cước</Typography>
                  <Typography variant="h6" color="primary">
                    {selectedEstimate && formatCurrency(selectedEstimate.fare)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            <Alert severity="info" sx={{ mt: 2 }}>
              Hệ thống sẽ chuyển sang bước tìm tài xế gần nhất ngay sau khi bạn xác nhận chuyến.
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  const content = (
    <>
      <DialogTitle sx={{ pb: 1.5, px: presentation === 'inline' ? 0 : undefined }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Box sx={{ width: 42, height: 4, borderRadius: 999, bgcolor: 'grey.300' }} />
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6" fontWeight={800}>
            Hoàn tất đặt xe
          </Typography>
          <Stepper activeStep={activeStep} alternativeLabel={!isMobile}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: presentation === 'inline' ? 0 : undefined }}>
        <Box data-testid="ride-booking-flow">
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <Stack spacing={1.5} alignItems="center">
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Đang tải bảng giá, bạn vẫn có thể đóng khung này nếu muốn chọn lại hành trình.
              </Typography>
            </Stack>
          </Box>
        ) : (
          renderStepContent()
        )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: presentation === 'inline' ? 0 : 3, pb: presentation === 'inline' ? 0 : 3, pt: 1.5 }}>
        <Button onClick={onClose} disabled={creating}>
          {presentation === 'inline' ? 'Đóng' : 'Hủy'}
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={creating} data-testid="ride-booking-back">
            Quay lại
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} variant="contained" disabled={loading || !selectedEstimate} data-testid="ride-booking-next" sx={{ borderRadius: 3, minWidth: 132 }}>
            Tiếp tục
          </Button>
        ) : (
          <Button onClick={handleConfirmBooking} variant="contained" disabled={creating || loading} data-testid="confirm-booking-button" sx={{ borderRadius: 3, minWidth: 182 }}>
            {creating ? <CircularProgress size={24} /> : 'Xác nhận và tìm tài xế'}
          </Button>
        )}
      </DialogActions>
    </>
  );

  if (!open) {
    return null;
  }

  if (presentation === 'inline') {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 5,
          p: 2.5,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))',
          border: '1px solid rgba(148,163,184,0.16)',
          boxShadow: '0 18px 42px rgba(15,23,42,0.10)',
        }}
      >
        {content}
      </Paper>
    );
  }

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderRadius: '24px 24px 0 0',
            maxHeight: '92vh',
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 5 } }}>
      {content}
    </Dialog>
  );
};

export default RideBookingFlow;
