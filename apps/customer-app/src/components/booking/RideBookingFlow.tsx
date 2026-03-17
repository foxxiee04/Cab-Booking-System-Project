import React, { useCallback, useEffect, useState } from 'react';
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
    name: 'Economy',
    icon: <DirectionsCar fontSize="large" />,
    description: 'Affordable rides',
    capacity: 4,
    priceMultiplier: 1.0,
  },
  {
    type: 'COMFORT',
    name: 'Comfort',
    icon: <LocalTaxi fontSize="large" />,
    description: 'More space',
    capacity: 4,
    priceMultiplier: 1.3,
  },
  {
    type: 'PREMIUM',
    name: 'Premium',
    icon: <AirportShuttle fontSize="large" />,
    description: 'Luxury experience',
    capacity: 6,
    priceMultiplier: 1.8,
  },
];

const paymentOptions = [
  { method: 'CASH', label: 'Cash', icon: <MoneyOff /> },
  { method: 'CARD', label: 'Credit Card', icon: <CreditCard /> },
  { method: 'WALLET', label: 'E-Wallet', icon: <AccountBalanceWallet /> },
];

const RideBookingFlow: React.FC<RideBookingFlowProps> = ({
  open,
  onClose,
  pickup,
  dropoff,
  onRideCreated,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStep, setActiveStep] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<'ECONOMY' | 'COMFORT' | 'PREMIUM'>('ECONOMY');
  const [selectedPayment, setSelectedPayment] = useState<'CASH' | 'CARD' | 'WALLET'>('CASH');
  const [priceEstimates, setPriceEstimates] = useState<Record<string, PriceEstimate>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const steps = ['Chọn xe', 'Thanh toán', 'Xác nhận'];

  // Fetch price estimates for all vehicle types
  const fetchPriceEstimates = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const estimates: Record<string, PriceEstimate> = {};

      for (const vehicle of vehicleOptions) {
        const response = await pricingApi.estimateFare({
          pickup,
          dropoff,
          vehicleType: vehicle.type,
        });

        estimates[vehicle.type] = {
          fare: response.data.fare,
          distance: response.data.distance,
          duration: response.data.duration,
          surgeMultiplier: response.data.surgeMultiplier || 1.0,
        };
      }

      setPriceEstimates(estimates);
      setActiveStep(0); // Start at vehicle selection step
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load price estimates');
    } finally {
      setLoading(false);
    }
  }, [dropoff, pickup]);

  useEffect(() => {
    if (open && pickup && dropoff) {
      fetchPriceEstimates();
    }
  }, [dropoff, fetchPriceEstimates, open, pickup]);

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
      setError(err.response?.data?.error?.message || 'Failed to create ride');
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
            <Grid container spacing={2}>
              {vehicleOptions.map((vehicle) => {
                const estimate = priceEstimates[vehicle.type];
                return (
                  <Grid item xs={12} key={vehicle.type}>
                    <Card
                      variant={selectedVehicle === vehicle.type ? 'elevation' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        border: selectedVehicle === vehicle.type ? 2 : 1,
                        borderColor: selectedVehicle === vehicle.type ? 'primary.main' : 'divider',
                        borderRadius: 4,
                        boxShadow: selectedVehicle === vehicle.type ? '0 10px 28px rgba(37,99,235,0.18)' : undefined,
                      }}
                      onClick={() => setSelectedVehicle(vehicle.type)}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={2}>
                            <Box color="primary.main">{vehicle.icon}</Box>
                            <Box>
                              <Typography variant="h6" fontWeight={800}>{vehicle.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {vehicle.description} • {vehicle.capacity} seats
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
                                    label={`${estimate.surgeMultiplier}x surge`}
                                    color="error"
                                  />
                                )}
                              </>
                            ) : (
                              <CircularProgress size={24} />
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
                  <Typography>{pickup.address || 'Selected location'}</Typography>
                </Box>
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Điểm đến
                  </Typography>
                  <Typography>{dropoff.address || 'Selected location'}</Typography>
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
      <DialogTitle sx={{ pb: 1.5 }}>
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
      <DialogContent>
        <Box data-testid="ride-booking-flow">
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          renderStepContent()
        )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 1.5 }}>
        <Button onClick={onClose} disabled={creating}>
          Hủy
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
