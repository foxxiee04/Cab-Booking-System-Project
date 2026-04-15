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
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  AccountBalanceWallet,
  AccountBalance,
  CheckCircleRounded,
  ChevronRightRounded,
  LocalOfferRounded,
  MoneyOff,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { formatCurrency } from '../../utils/format.utils';
import { pricingApi } from '../../api/pricing.api';
import { rideApi } from '../../api/ride.api';
import { paymentApi } from '../../api/payment.api';
import voucherApi, { ApplyVoucherResult, MyVoucher } from '../../api/voucher.api';
import { Location } from '../../types';
import motorbikeImage from '../../assets/vehicles/xe_may.jpg';
import scooterImage from '../../assets/vehicles/xe_ga.jpg';
import car4Image from '../../assets/vehicles/xe_4_cho.jpg';
import car7Image from '../../assets/vehicles/xe_7_cho.jpg';

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
  estimatedWaitMinutes?: number;
}

interface VehicleOption {
  type: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
  name: string;
  imageSrc: string;
  description: string;
  capacity: number;
  priceMultiplier: number;
}

const FALLBACK_PRICING: Record<VehicleOption['type'], { baseFare: number; perKmRate: number; perMinuteRate: number }> = {
  MOTORBIKE: { baseFare: 9000, perKmRate: 6500, perMinuteRate: 500 },
  SCOOTER: { baseFare: 11000, perKmRate: 7800, perMinuteRate: 650 },
  CAR_4: { baseFare: 17000, perKmRate: 12500, perMinuteRate: 1500 },
  CAR_7: { baseFare: 22000, perKmRate: 15500, perMinuteRate: 1900 },
};

const MINIMUM_FARE = 15000;

const MIN_PRICE_GAP: Record<'SCOOTER' | 'CAR_7', number> = {
  SCOOTER: 1500,
  CAR_7: 5000,
};

const vehicleOptions: VehicleOption[] = [
  {
    type: 'MOTORBIKE',
    name: 'Xe máy',
    imageSrc: motorbikeImage,
    description: 'Nhanh, linh hoạt',
    capacity: 1,
    priceMultiplier: 1.0,
  },
  {
    type: 'SCOOTER',
    name: 'Xe ga',
    imageSrc: scooterImage,
    description: 'Êm và thoải mái',
    capacity: 1,
    priceMultiplier: 1.15,
  },
  {
    type: 'CAR_4',
    name: 'Xe 4 chỗ',
    imageSrc: car4Image,
    description: 'Phổ thông, nhóm nhỏ',
    capacity: 4,
    priceMultiplier: 1.7,
  },
  {
    type: 'CAR_7',
    name: 'Xe 7 chỗ',
    imageSrc: car7Image,
    description: 'Rộng rãi cho nhóm đông',
    capacity: 7,
    priceMultiplier: 2.2,
  },
];

const paymentOptions = [
  { method: 'CASH', label: 'Tiền mặt', icon: <MoneyOff />, helper: 'Thanh toán trực tiếp khi kết thúc chuyến đi.' },
  { method: 'MOMO', label: 'Ví MoMo', icon: <AccountBalanceWallet />, helper: 'Thanh toán bằng ví điện tử MoMo.' },
  { method: 'VNPAY', label: 'VNPay QR / Ngân hàng', icon: <AccountBalance />, helper: 'Thanh toán qua QR hoặc ứng dụng ngân hàng.' },
];

const VEHICLE_FETCH_ORDER: Array<'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7'> = ['MOTORBIKE', 'SCOOTER', 'CAR_4', 'CAR_7'];

const enforceVehiclePriceOrder = (estimates: Record<string, PriceEstimate>): Record<string, PriceEstimate> => {
  const ordered = { ...estimates };

  const motorbikeFare = ordered.MOTORBIKE?.fare;
  const scooterFare = ordered.SCOOTER?.fare;
  if (Number.isFinite(motorbikeFare) && Number.isFinite(scooterFare) && scooterFare <= motorbikeFare) {
    ordered.SCOOTER = {
      ...ordered.SCOOTER,
      fare: Math.max(Math.round(motorbikeFare + MIN_PRICE_GAP.SCOOTER), MINIMUM_FARE),
    };
  }

  const car4Fare = ordered.CAR_4?.fare;
  const car7Fare = ordered.CAR_7?.fare;
  if (Number.isFinite(car4Fare) && Number.isFinite(car7Fare) && car7Fare <= car4Fare) {
    ordered.CAR_7 = {
      ...ordered.CAR_7,
      fare: Math.max(Math.round(car4Fare + MIN_PRICE_GAP.CAR_7), MINIMUM_FARE),
    };
  }

  return ordered;
};

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

const formatEstimateDistance = (distanceKm: number): string => {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 'Đang cập nhật';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm >= 10 ? distanceKm.toFixed(0) : distanceKm.toFixed(1)} km`;
};

const formatEstimateDuration = (durationSeconds: number): string => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 'Đang cập nhật';
  }

  return `~${Math.max(1, Math.round(durationSeconds / 60))} phút`;
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
  const [selectedVehicle, setSelectedVehicle] = useState<'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7'>('CAR_4');
  const [selectedPayment, setSelectedPayment] = useState<'CASH' | 'MOMO' | 'VNPAY'>('CASH');
  // Voucher
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherResult, setVoucherResult] = useState<ApplyVoucherResult | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  // Voucher picker sheet
  const [pickerOpen, setPickerOpen] = useState(false);
  const [myVouchers, setMyVouchers] = useState<MyVoucher[]>([]);
  const [myVouchersLoading, setMyVouchersLoading] = useState(false);
  const [priceEstimates, setPriceEstimates] = useState<Record<string, PriceEstimate>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const confirmInFlightRef = useRef(false);
  const estimateRequestIdRef = useRef(0);
  const pickupLat = pickup?.lat;
  const pickupLng = pickup?.lng;
  const pickupAddress = pickup?.address;
  const dropoffLat = dropoff?.lat;
  const dropoffLng = dropoff?.lng;
  const dropoffAddress = dropoff?.address;

  const handleApplyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    setVoucherError('');
    setVoucherResult(null);
    setVoucherLoading(true);
    try {
      const fare = selectedEstimate?.fare ?? 0;
      const res = await voucherApi.applyVoucher(code, fare);
      setVoucherResult(res.data.data);
      setPickerOpen(false);
    } catch (err: any) {
      setVoucherError(err.response?.data?.error?.message || 'Mã voucher không hợp lệ');
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleSelectSavedVoucher = async (code: string) => {
    setVoucherCode(code);
    setVoucherError('');
    setVoucherResult(null);
    setVoucherLoading(true);
    try {
      const fare = selectedEstimate?.fare ?? 0;
      const res = await voucherApi.applyVoucher(code, fare);
      setVoucherResult(res.data.data);
      setPickerOpen(false);
    } catch (err: any) {
      setVoucherError(err.response?.data?.error?.message || 'Mã voucher không hợp lệ');
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleOpenPicker = async () => {
    setPickerOpen(true);
    setMyVouchersLoading(true);
    try {
      const res = await voucherApi.getMyVouchers();
      setMyVouchers(res.data.data.filter((v) => v.status === 'USABLE'));
    } catch { setMyVouchers([]); }
    finally { setMyVouchersLoading(false); }
  };

  const handleRemoveVoucher = () => {
    setVoucherResult(null);
    setVoucherCode('');
    setVoucherError('');
  };

  const steps = ['Chọn xe', 'Thanh toán', 'Xác nhận'];

  const fetchEstimate = useCallback(async (vehicleType: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7') => {
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

    const estimate = response.data;
    const distance = Number(estimate.distance) || 0;
    const duration = Number(estimate.duration) || 0;
    const durationMinutes = Math.max(1, Math.round(duration / 60));
    const surgeMultiplier = Number(estimate.surgeMultiplier) > 0 ? Number(estimate.surgeMultiplier) : 1;
    const fareFromApi = Number(estimate.fare);

    let fare = Number.isFinite(fareFromApi) ? fareFromApi : 0;

    if (fare <= 0) {
      const fallback = FALLBACK_PRICING[vehicleType];
      const subtotal = fallback.baseFare + distance * fallback.perKmRate + durationMinutes * fallback.perMinuteRate;
      fare = Math.max(Math.round(subtotal * surgeMultiplier), MINIMUM_FARE);
    }

    return {
      fare,
      distance,
      duration,
      surgeMultiplier,
      estimatedWaitMinutes: Number.isFinite(Number(estimate.estimatedWaitMinutes)) && Number(estimate.estimatedWaitMinutes) > 0
        ? Number(estimate.estimatedWaitMinutes)
        : undefined,
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
      const primaryVehicle: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7' = 'CAR_4';
      const primaryEstimate = await fetchEstimate(primaryVehicle);

      if (estimateRequestIdRef.current !== requestId) {
        return;
      }

      setPriceEstimates({ [primaryVehicle]: primaryEstimate });
      setSelectedVehicle(primaryVehicle);
      setActiveStep(0); // Start at vehicle selection step
      setLoading(false);

      setLoadingMore(true);
      const remainingVehicles = VEHICLE_FETCH_ORDER.filter((vehicleType) => vehicleType !== primaryVehicle);

      await Promise.allSettled(
        remainingVehicles.map(async (vehicleType) => {
          if (estimateRequestIdRef.current !== requestId) {
            return;
          }

          const estimate = await fetchEstimate(vehicleType);

          if (estimateRequestIdRef.current !== requestId) {
            return;
          }

          setPriceEstimates((prev) => enforceVehiclePriceOrder({ ...prev, [vehicleType]: estimate }));
        })
      );
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
    if (confirmInFlightRef.current) {
      return;
    }

    confirmInFlightRef.current = true;
    setCreating(true);
    setError('');

    try {
      const response = await rideApi.createRide({
        pickup,
        dropoff,
        vehicleType: selectedVehicle,
        paymentMethod: selectedPayment,
      });

      const rideId = response.data.ride.id;

      if (selectedPayment === 'MOMO' || selectedPayment === 'VNPAY') {
        const amount = Math.round(selectedEstimate?.fare || 0);
        if (amount <= 0) {
          throw new Error('Không thể khởi tạo thanh toán vì giá chuyến đi chưa hợp lệ. Vui lòng chọn lại điểm đón/điểm đến.');
        }

        const returnUrl = `${window.location.origin}/payment/callback?provider=${selectedPayment}&rideId=${rideId}`;

        try {
          const paymentResponse = selectedPayment === 'MOMO'
            ? await paymentApi.createMomoPayment({ rideId, amount, returnUrl })
            : await paymentApi.createVnpayPayment({ rideId, amount, returnUrl });

          const gatewayUrl = paymentResponse.data?.payUrl || paymentResponse.data?.paymentUrl;
          if (gatewayUrl) {
            onClose();
            window.location.assign(gatewayUrl);
            return;
          }
        } catch (paymentError) {
          console.error('Online payment create failed:', paymentError);
        }

        onClose();
        const params = new URLSearchParams({ amount: String(amount), provider: selectedPayment, rideId });
        window.location.assign(`${window.location.origin}/payment/sandbox-gateway?${params.toString()}`);
        return;
      }

      onRideCreated(rideId);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tạo chuyến xe');
    } finally {
      confirmInFlightRef.current = false;
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
            <Grid container spacing={1.4}>
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
                        transition: 'border-color 160ms ease, box-shadow 180ms ease, transform 180ms ease',
                        '&:hover': estimate ? {
                          borderColor: selectedVehicle === vehicle.type ? 'primary.main' : 'primary.light',
                          transform: 'translateY(-1px)',
                        } : undefined,
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
                            <Box
                              sx={{
                                width: 68,
                                height: 68,
                                borderRadius: 3,
                                overflow: 'hidden',
                                bgcolor: 'grey.100',
                                border: '1px solid',
                                borderColor: selectedVehicle === vehicle.type ? 'primary.main' : 'divider',
                                flexShrink: 0,
                              }}
                            >
                              <Box
                                component="img"
                                src={vehicle.imageSrc}
                                alt={vehicle.name}
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                              />
                            </Box>
                            <Box>
                              <Typography variant="h6" fontWeight={800}>{vehicle.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {vehicle.description} • {vehicle.capacity} chỗ
                              </Typography>
                              {estimate && (
                                <Stack spacing={0.45} sx={{ mt: 0.75 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Lộ trình dự kiến: {formatEstimateDistance(estimate.distance)} • Di chuyển {formatEstimateDuration(estimate.duration)}
                                  </Typography>
                                  {estimate.estimatedWaitMinutes != null && (
                                    <Chip
                                      size="small"
                                      label={`Ghép tài xế ${Math.max(1, Math.round(estimate.estimatedWaitMinutes))} phút`}
                                      color={estimate.estimatedWaitMinutes > 8 ? 'warning' : 'default'}
                                      sx={{ height: 18, fontSize: '0.68rem' }}
                                    />
                                  )}
                                  <Typography variant="caption" color="text.secondary">
                                    Cước và quãng đường dựa trên tuyến đường hiện tại; thời gian ghép tài xế dựa trên mật độ tài xế gần điểm đón.
                                  </Typography>
                                </Stack>
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
                    variant={selectedPayment === option.method ? 'elevation' : 'outlined'}
                    sx={{
                      mb: 2,
                      cursor: 'pointer',
                      borderRadius: 4,
                      border: selectedPayment === option.method ? 2 : 1,
                      borderColor: selectedPayment === option.method ? 'primary.main' : 'divider',
                      bgcolor: selectedPayment === option.method ? 'rgba(37,99,235,0.06)' : undefined,
                    }}
                    onClick={() => setSelectedPayment(option.method as any)}
                  >
                    <CardContent>
                      <FormControlLabel
                        value={option.method}
                        control={<Radio />}
                        label={
                          <Box display="flex" alignItems="center" gap={2}>
                            {option.icon}
                            <Box>
                              <Typography>{option.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.helper}
                              </Typography>
                            </Box>
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
                {selectedEstimate && (
                  <>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography>Quãng đường dự kiến</Typography>
                      <Typography fontWeight="bold">
                        {formatEstimateDistance(selectedEstimate.distance)}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography>Thời gian di chuyển</Typography>
                      <Typography fontWeight="bold">
                        {formatEstimateDuration(selectedEstimate.duration)}
                      </Typography>
                    </Box>
                    {selectedEstimate.estimatedWaitMinutes != null && (
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography>Thời gian ghép tài xế</Typography>
                        <Typography fontWeight="bold">
                          ~{Math.max(1, Math.round(selectedEstimate.estimatedWaitMinutes))} phút
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
                {voucherResult ? (
                  <>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography>Cước phí gốc</Typography>
                      <Typography fontWeight="bold">{selectedEstimate && formatCurrency(selectedEstimate.fare)}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <LocalOfferRounded fontSize="small" color="success" />
                        <Typography color="success.dark">Giảm ({voucherResult.code})</Typography>
                      </Stack>
                      <Typography fontWeight="bold" color="success.dark">
                        -{formatCurrency(voucherResult.discountAmount)}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="h6">Tổng thanh toán</Typography>
                      <Typography variant="h6" color="primary" fontWeight={900}>
                        {formatCurrency(voucherResult.finalAmount)}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="h6">Tổng cước</Typography>
                    <Typography variant="h6" color="primary">
                      {selectedEstimate && formatCurrency(selectedEstimate.fare)}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Voucher / Promo code section */}
            <Box mt={2.5}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Áp mã ưu đãi
              </Typography>
              {voucherResult ? (
                <Card
                  variant="outlined"
                  sx={{ borderRadius: 3, bgcolor: 'success.50', borderColor: 'success.300' }}
                >
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <LocalOfferRounded color="success" fontSize="small" />
                        <Box>
                          <Typography variant="body2" fontWeight={700} color="success.dark">
                            {voucherResult.code}
                          </Typography>
                          <Typography variant="caption" color="success.dark">
                            Giảm {formatCurrency(voucherResult.discountAmount)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Button
                        size="small"
                        color="error"
                        onClick={handleRemoveVoucher}
                        sx={{ fontWeight: 700, minWidth: 0 }}
                      >
                        Xóa mã
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ) : (
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
                    transition: 'all 150ms',
                  }}
                  onClick={handleOpenPicker}
                >
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <LocalOfferRounded color="action" />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            Chọn hoặc nhập mã ưu đãi
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Xem voucher đã lưu hoặc nhập mã mới
                          </Typography>
                        </Box>
                      </Stack>
                      <ChevronRightRounded color="action" />
                    </Stack>
                  </CardContent>
                </Card>
              )}
              {voucherError && (
                <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>
                  {voucherError}
                </Alert>
              )}
            </Box>

            {/* Voucher picker drawer for confirm step */}
            <Drawer
              anchor="bottom"
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              PaperProps={{ sx: { borderRadius: '20px 20px 0 0', height: '75vh', maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column' } }}
            >
              <Box sx={{ px: 2.5, pt: 2.5, pb: 0, flexShrink: 0 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 99, mx: 'auto', mb: 2 }} />
                <Typography variant="h6" fontWeight={800} mb={2}>Chọn mã giảm giá</Typography>
                <Stack direction="row" spacing={1} mb={2}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Nhập mã voucher"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocalOfferRounded fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: 3, letterSpacing: 1 },
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleApplyVoucher}
                    disabled={voucherLoading || !voucherCode.trim()}
                    sx={{ borderRadius: 3, fontWeight: 700, flexShrink: 0 }}
                  >
                    {voucherLoading ? <CircularProgress size={18} color="inherit" /> : 'Dùng'}
                  </Button>
                </Stack>
              </Box>
              {/* Scrollable voucher list */}
              <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, pb: 4 }}>
                {myVouchersLoading ? (
                  <Stack spacing={1}>
                    {[1, 2].map((i) => <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 3 }} />)}
                  </Stack>
                ) : myVouchers.length === 0 ? (
                  <Box textAlign="center" py={3} color="text.secondary">
                    <LocalOfferRounded sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
                    <Typography variant="body2">Bạn chưa có voucher khả dụng</Typography>
                  </Box>
                ) : (
                  <Stack spacing={1} pb={3}>
                    <Typography variant="overline" color="text.secondary" fontWeight={700}>Voucher đã lưu</Typography>
                    {myVouchers.map((mv) => {
                      const isSelected = voucherResult?.code === mv.code;
                      const discountText = mv.discountType === 'PERCENT'
                        ? `Giảm ${mv.discountValue}%${mv.maxDiscount ? ` (tối đa ${formatCurrency(mv.maxDiscount)})` : ''}`
                        : `Giảm ${formatCurrency(mv.discountValue)}`;
                      const eligible = !selectedEstimate || mv.minFare === 0 || selectedEstimate.fare >= mv.minFare;
                      return (
                        <Card
                          key={mv.voucherId}
                          variant="outlined"
                          onClick={() => eligible && handleSelectSavedVoucher(mv.code)}
                          sx={{
                            borderRadius: 3,
                            cursor: eligible ? 'pointer' : 'default',
                            opacity: eligible ? 1 : 0.5,
                            borderColor: isSelected ? 'success.main' : 'divider',
                            bgcolor: isSelected ? 'success.50' : undefined,
                            '&:hover': eligible && !isSelected ? { borderColor: 'primary.main', bgcolor: 'primary.50' } : {},
                            transition: 'all 150ms',
                          }}
                        >
                          <CardContent sx={{ py: 1.25, px: 2, '&:last-child': { pb: 1.25 } }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Box
                                  sx={{
                                    width: 36, height: 36, borderRadius: 2,
                                    bgcolor: isSelected ? 'success.main' : eligible ? 'primary.main' : 'action.disabledBackground',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                  }}
                                >
                                  {isSelected
                                    ? <CheckCircleRounded sx={{ color: '#fff', fontSize: 20 }} />
                                    : <LocalOfferRounded sx={{ color: eligible ? '#fff' : 'action.disabled', fontSize: 18 }} />}
                                </Box>
                                <Box>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2" fontWeight={800}>{mv.code}</Typography>
                                    <Chip label={discountText} size="small" color={eligible ? 'primary' : 'default'} sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
                                  </Stack>
                                  <Typography variant="caption" color={eligible ? 'text.secondary' : 'error.main'}>
                                    {mv.minFare > 0 ? `Đơn tối thiểu ${formatCurrency(mv.minFare)}` : 'Không yêu cầu giá tối thiểu'}
                                    {!eligible && ' — chuyến này chưa đủ điều kiện'}
                                  </Typography>
                                </Box>
                              </Stack>
                              {!isSelected && eligible && <ChevronRightRounded color="action" fontSize="small" />}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            </Drawer>
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
        {loading && !selectedEstimate ? (
          <Box display="flex" justifyContent="center" py={4}>
            <Stack spacing={1.5} alignItems="center">
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Đang tải giá chuyến đầu tiên để bạn chọn xe.
              </Typography>
            </Stack>
          </Box>
        ) : (
          renderStepContent()
        )}
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          px: presentation === 'inline' ? 0 : 3,
          pb: presentation === 'inline' ? 0 : 3,
          pt: 1.5,
          gap: 1,
          flexWrap: 'wrap',
          justifyContent: isMobile ? 'stretch' : 'flex-end',
        }}
      >
        <Button onClick={onClose} disabled={creating} fullWidth={isMobile}>
          {presentation === 'inline' ? 'Đóng' : 'Hủy'}
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={creating} data-testid="ride-booking-back" fullWidth={isMobile}>
            Quay lại
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} variant="contained" disabled={loading || !selectedEstimate} data-testid="ride-booking-next" fullWidth={isMobile} sx={{ borderRadius: 3, minWidth: 132 }}>
            Tiếp tục
          </Button>
        ) : (
          <Button onClick={handleConfirmBooking} variant="contained" disabled={creating || loading || !selectedEstimate} data-testid="confirm-booking-button" fullWidth={isMobile} sx={{ borderRadius: 3, minWidth: 182 }}>
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
            maxHeight: '88vh',
            maxWidth: 600,
            mx: 'auto',
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
