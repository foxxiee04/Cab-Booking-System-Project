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
import voucherApi, { ApplyVoucherResult, MyVoucher, PublicVoucher, VoucherAudience } from '../../api/voucher.api';
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

const FALLBACK_PRICING: Record<VehicleOption['type'], { baseFare: number; perKmRate: number; perMinuteRate: number; vehicleServiceFee: number; shortTripFee: number }> = {
  MOTORBIKE: { baseFare: 10000, perKmRate: 6200,  perMinuteRate: 450,  vehicleServiceFee: 0,     shortTripFee: 0     },
  SCOOTER:   { baseFare: 16000, perKmRate: 9500,   perMinuteRate: 800,  vehicleServiceFee: 2000,  shortTripFee: 2000  },
  CAR_4:     { baseFare: 28000, perKmRate: 18000,  perMinuteRate: 2200, vehicleServiceFee: 8000,  shortTripFee: 8000  },
  CAR_7:     { baseFare: 40000, perKmRate: 24000,  perMinuteRate: 3000, vehicleServiceFee: 12000, shortTripFee: 12000 },
};

const MINIMUM_FARE = 15000;
const SHORT_TRIP_THRESHOLD_KM = 2.5;

const MIN_PRICE_GAP: Record<'SCOOTER' | 'CAR_4' | 'CAR_7', number> = {
  SCOOTER: 8000,
  CAR_4:   30000,
  CAR_7:   25000,
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

const VOUCHER_AUDIENCE_LABELS: Record<VoucherAudience, string> = {
  ALL_CUSTOMERS: 'Mọi khách hàng',
  NEW_CUSTOMERS: 'Khách mới',
  RETURNING_CUSTOMERS: 'Khách quay lại',
};

const getVoucherDiscountText = (voucher: Pick<MyVoucher | PublicVoucher, 'discountType' | 'discountValue' | 'maxDiscount'>): string => {
  if (voucher.discountType === 'PERCENT') {
    return `Giảm ${voucher.discountValue}%${voucher.maxDiscount ? ` · tối đa ${formatCurrency(voucher.maxDiscount)}` : ''}`;
  }

  return `Giảm ${formatCurrency(voucher.discountValue)}`;
};

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

  const normalizedScooterFare = ordered.SCOOTER?.fare;
  const car4Fare = ordered.CAR_4?.fare;
  if (Number.isFinite(normalizedScooterFare) && Number.isFinite(car4Fare) && car4Fare <= normalizedScooterFare) {
    ordered.CAR_4 = {
      ...ordered.CAR_4,
      fare: Math.max(Math.round(normalizedScooterFare + MIN_PRICE_GAP.CAR_4), MINIMUM_FARE),
    };
  }

  const normalizedCar4Fare = ordered.CAR_4?.fare;
  const car7Fare = ordered.CAR_7?.fare;
  if (Number.isFinite(normalizedCar4Fare) && Number.isFinite(car7Fare) && car7Fare <= normalizedCar4Fare) {
    ordered.CAR_7 = {
      ...ordered.CAR_7,
      fare: Math.max(Math.round(normalizedCar4Fare + MIN_PRICE_GAP.CAR_7), MINIMUM_FARE),
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
  const [publicVouchers, setPublicVouchers] = useState<PublicVoucher[]>([]);
  const [publicVouchersLoading, setPublicVouchersLoading] = useState(false);
  const [collectingVoucherCode, setCollectingVoucherCode] = useState<string | null>(null);
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
  const selectedEstimate = priceEstimates[selectedVehicle];
  const currentFare = selectedEstimate?.fare ?? 0;

  const applyVoucherCode = useCallback(async (code: string, closePickerOnSuccess = true) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;

    setVoucherCode(normalizedCode);
    setVoucherError('');
    setVoucherLoading(true);
    // Don't clear voucherResult immediately to prevent UI flash/jitter

    try {
      const res = await voucherApi.applyVoucher(normalizedCode, currentFare);
      setVoucherResult(res.data.data);
      setVoucherLoading(false);
      if (closePickerOnSuccess) {
        // Delay picker close to prevent jitter from simultaneous state+dialog transitions
        window.setTimeout(() => setPickerOpen(false), 80);
      }
    } catch (err: any) {
      setVoucherError(err.response?.data?.error?.message || 'Mã voucher không hợp lệ');
      setVoucherLoading(false);
    }
  }, [currentFare]);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    await applyVoucherCode(voucherCode);
  };

  const handleSelectSavedVoucher = async (code: string) => {
    await applyVoucherCode(code);
  };

  const handleOpenPicker = async () => {
    setPickerOpen(true);
    setVoucherError('');
    setMyVouchersLoading(true);
    setPublicVouchersLoading(true);
    try {
      const [myResult, publicResult] = await Promise.allSettled([
        voucherApi.getMyVouchers(),
        voucherApi.getPublicVouchers(),
      ]);

      if (myResult.status === 'fulfilled') {
        setMyVouchers(myResult.value.data.data.filter((voucher) => voucher.status === 'USABLE'));
      } else {
        setMyVouchers([]);
      }

      if (publicResult.status === 'fulfilled') {
        setPublicVouchers(publicResult.value.data.data);
      } else {
        setPublicVouchers([]);
      }
    } finally {
      setMyVouchersLoading(false);
      setPublicVouchersLoading(false);
    }
  };

  const handleCollectVoucher = async (voucher: PublicVoucher) => {
    const normalizedCode = voucher.code.trim().toUpperCase();
    const eligible = currentFare <= 0 || voucher.minFare === 0 || currentFare >= voucher.minFare;

    setCollectingVoucherCode(normalizedCode);
    setVoucherError('');

    try {
      if (!voucher.collected) {
        const response = await voucherApi.collectVoucher(normalizedCode);
        const collectedVoucher = response.data.data;

        setMyVouchers((prev) => {
          const others = prev.filter((item) => item.voucherId !== collectedVoucher.voucherId);
          return [collectedVoucher, ...others];
        });
        setPublicVouchers((prev) => prev.map((item) => (
          item.voucherId === voucher.voucherId ? { ...item, collected: true } : item
        )));
      }

      if (eligible) {
        await applyVoucherCode(normalizedCode);
      } else {
        setVoucherCode(normalizedCode);
        setVoucherError('Voucher đã được lưu, nhưng chuyến đi hiện tại chưa đủ điều kiện áp dụng.');
      }
    } catch (err: any) {
      setVoucherError(err.response?.data?.error?.message || 'Không thể thu thập voucher lúc này');
    } finally {
      setCollectingVoucherCode(null);
    }
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
      const shortTripFee = distance > 0 && distance < SHORT_TRIP_THRESHOLD_KM
        ? fallback.shortTripFee
        : 0;
      const subtotal = fallback.baseFare
        + fallback.vehicleServiceFee
        + distance * fallback.perKmRate
        + durationMinutes * fallback.perMinuteRate
        + shortTripFee;
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

  useEffect(() => {
    if (!voucherResult || currentFare <= 0) {
      return;
    }

    if (Math.round(voucherResult.originalAmount) === Math.round(currentFare)) {
      return;
    }

    // Debounce re-apply to prevent jitter when switching vehicles
    const timer = window.setTimeout(() => {
      void applyVoucherCode(voucherResult.code, false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [applyVoucherCode, currentFare, voucherResult]);

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
        voucherCode: voucherResult?.code,
      });

      const rideId = response.data.ride.id;

      if (selectedPayment === 'MOMO' || selectedPayment === 'VNPAY') {
        const amount = Math.round(voucherResult?.finalAmount || currentFare);
        if (amount <= 0) {
          throw new Error('Không thể khởi tạo thanh toán vì giá chuyến đi chưa hợp lệ. Vui lòng chọn lại điểm đón/điểm đến.');
        }

        const returnUrl = selectedPayment === 'VNPAY'
          ? `${window.location.origin}/payment/callback`
          : `${window.location.origin}/payment/callback?provider=${selectedPayment}&rideId=${rideId}`;

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
        if (voucherResult) {
          params.set('voucherCode', voucherResult.code);
          params.set('originalAmount', String(Math.round(voucherResult.originalAmount)));
          params.set('discountAmount', String(Math.round(voucherResult.discountAmount)));
        }
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

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Vehicle Selection
        return (
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={800}>
              Chọn loại xe
            </Typography>
            {loadingMore && (
              <Alert severity="info" icon={false} sx={{ mb: 1.5, py: 0.5, borderRadius: 3, fontSize: '0.82rem' }}>
                Đang tải giá các loại xe còn lại...
              </Alert>
            )}
            <Stack spacing={1.2}>
              {vehicleOptions.map((vehicle) => {
                const estimate = priceEstimates[vehicle.type];
                const isSelected = selectedVehicle === vehicle.type;
                return (
                  <Card
                    key={vehicle.type}
                    variant={isSelected ? 'elevation' : 'outlined'}
                    sx={{
                      cursor: estimate ? 'pointer' : 'not-allowed',
                      opacity: estimate ? 1 : 0.6,
                      border: isSelected ? 2 : 1,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 3,
                      boxShadow: isSelected ? '0 6px 20px rgba(37,99,235,0.16)' : 'none',
                      transition: 'border-color 140ms ease, box-shadow 160ms ease',
                      '&:hover': estimate ? { borderColor: 'primary.light' } : undefined,
                    }}
                    onClick={() => estimate && setSelectedVehicle(vehicle.type)}
                  >
                    <CardContent sx={{ p: '12px 14px !important' }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                          sx={{
                            width: 60,
                            height: 60,
                            borderRadius: 2.5,
                            overflow: 'hidden',
                            bgcolor: 'grey.100',
                            flexShrink: 0,
                            border: '1px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                          }}
                        >
                          <Box
                            component="img"
                            src={vehicle.imageSrc}
                            alt={vehicle.name}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </Box>

                        <Box flexGrow={1} minWidth={0}>
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                              {vehicle.name}
                            </Typography>
                            <Box textAlign="right" flexShrink={0} ml={1}>
                              {estimate ? (
                                <>
                                  <Typography variant="subtitle1" color="primary" fontWeight={700} lineHeight={1.2}>
                                    {formatCurrency(estimate.fare)}
                                  </Typography>
                                  {estimate.surgeMultiplier > 1 && (
                                    <Chip size="small" label={`×${estimate.surgeMultiplier}`} color="error" sx={{ height: 16, fontSize: '0.65rem', mt: 0.25 }} />
                                  )}
                                </>
                              ) : (
                                <CircularProgress size={16} />
                              )}
                            </Box>
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>
                            {vehicle.description} • {vehicle.capacity} chỗ
                          </Typography>
                          {estimate && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.2 }}>
                              {formatEstimateDistance(estimate.distance)} · {formatEstimateDuration(estimate.duration)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5, textAlign: 'center' }}>
              Giá cước ước tính theo tuyến đường hiện tại, có thể thay đổi khi hoàn thành chuyến đi.
            </Typography>
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

            <Dialog
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              fullWidth
              maxWidth="sm"
              TransitionProps={{ timeout: { enter: 200, exit: 150 } }}
              PaperProps={{ sx: { borderRadius: 5, minHeight: 520, willChange: 'transform, opacity' } }}
            >
              <DialogTitle sx={{ pb: 1.5 }}>
                <Typography variant="h6" fontWeight={800}>Chọn mã giảm giá</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Thu thập voucher công khai hoặc dùng ngay voucher đã lưu cho chuyến này.
                </Typography>
              </DialogTitle>
              <DialogContent dividers sx={{ px: 2.5, py: 2 }}>
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
                {voucherError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    {voucherError}
                  </Alert>
                )}

                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={800}>Voucher đã lưu</Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {myVouchersLoading ? (
                        [1, 2].map((item) => <Skeleton key={item} variant="rounded" height={88} sx={{ borderRadius: 3 }} />)
                      ) : myVouchers.length === 0 ? (
                        <Box textAlign="center" py={3} color="text.secondary">
                          <LocalOfferRounded sx={{ fontSize: 36, mb: 1, opacity: 0.4 }} />
                          <Typography variant="body2">Bạn chưa có voucher khả dụng</Typography>
                        </Box>
                      ) : (
                        myVouchers.map((voucher) => {
                          const isSelected = voucherResult?.code === voucher.code;
                          const eligible = currentFare <= 0 || voucher.minFare === 0 || currentFare >= voucher.minFare;

                          return (
                            <Card
                              key={voucher.voucherId}
                              variant="outlined"
                              sx={{
                                borderRadius: 3,
                                borderColor: isSelected ? 'success.main' : eligible ? 'divider' : 'error.light',
                                bgcolor: isSelected ? 'success.50' : undefined,
                              }}
                            >
                              <CardContent sx={{ py: 1.4, px: 2, '&:last-child': { pb: 1.4 } }}>
                                <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                      <Typography variant="body1" fontWeight={800}>{voucher.code}</Typography>
                                      <Chip label={getVoucherDiscountText(voucher)} size="small" color={eligible ? 'primary' : 'default'} sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />
                                      <Chip label={VOUCHER_AUDIENCE_LABELS[voucher.audienceType]} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.8 }}>
                                      {voucher.description || 'Voucher áp dụng cho chuyến đi đủ điều kiện.'}
                                    </Typography>
                                    <Typography variant="caption" color={eligible ? 'text.secondary' : 'error.main'} display="block" sx={{ mt: 0.4 }}>
                                      {voucher.minFare > 0 ? `Đơn tối thiểu ${formatCurrency(voucher.minFare)}` : 'Không yêu cầu giá tối thiểu'}
                                      {!eligible && ' · Chuyến này chưa đủ điều kiện'}
                                    </Typography>
                                  </Box>
                                  <Button
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color={isSelected ? 'success' : 'primary'}
                                    onClick={() => handleSelectSavedVoucher(voucher.code)}
                                    disabled={!eligible || voucherLoading}
                                    sx={{ borderRadius: 2.5, minWidth: 112, fontWeight: 700 }}
                                  >
                                    {isSelected ? 'Đang dùng' : 'Dùng ngay'}
                                  </Button>
                                </Stack>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={800}>Voucher có thể thu thập</Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {publicVouchersLoading ? (
                        [1, 2].map((item) => <Skeleton key={item} variant="rounded" height={96} sx={{ borderRadius: 3 }} />)
                      ) : publicVouchers.filter((voucher) => !voucher.collected).length === 0 ? (
                        <Box textAlign="center" py={3} color="text.secondary">
                          <CheckCircleRounded sx={{ fontSize: 34, mb: 1, opacity: 0.45 }} />
                          <Typography variant="body2">Bạn đã lưu hết voucher công khai hiện có</Typography>
                        </Box>
                      ) : (
                        publicVouchers.filter((voucher) => !voucher.collected).map((voucher) => {
                          const eligible = currentFare <= 0 || voucher.minFare === 0 || currentFare >= voucher.minFare;
                          const isCollecting = collectingVoucherCode === voucher.code;

                          return (
                            <Card key={voucher.voucherId} variant="outlined" sx={{ borderRadius: 3 }}>
                              <CardContent sx={{ py: 1.4, px: 2, '&:last-child': { pb: 1.4 } }}>
                                <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                      <Typography variant="body1" fontWeight={800}>{voucher.code}</Typography>
                                      <Chip label={getVoucherDiscountText(voucher)} size="small" color={eligible ? 'primary' : 'default'} sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />
                                      <Chip label={VOUCHER_AUDIENCE_LABELS[voucher.audienceType]} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.8 }}>
                                      {voucher.description || 'Voucher công khai có thể lưu vào ví ưu đãi của bạn.'}
                                    </Typography>
                                    <Typography variant="caption" color={eligible ? 'text.secondary' : 'warning.main'} display="block" sx={{ mt: 0.4 }}>
                                      {voucher.minFare > 0 ? `Đơn tối thiểu ${formatCurrency(voucher.minFare)}` : 'Không yêu cầu giá tối thiểu'}
                                      {eligible ? ' · Dùng được cho chuyến này' : ' · Hiện chưa dùng được cho chuyến này'}
                                    </Typography>
                                  </Box>
                                  <Button
                                    variant="contained"
                                    onClick={() => handleCollectVoucher(voucher)}
                                    disabled={isCollecting}
                                    sx={{ borderRadius: 2.5, minWidth: 144, fontWeight: 700 }}
                                  >
                                    {isCollecting
                                      ? <CircularProgress size={18} color="inherit" />
                                      : eligible ? 'Thu thập và dùng' : 'Thu thập'}
                                  </Button>
                                </Stack>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button onClick={() => setPickerOpen(false)} sx={{ borderRadius: 2.5 }}>
                  Đóng
                </Button>
              </DialogActions>
            </Dialog>
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
