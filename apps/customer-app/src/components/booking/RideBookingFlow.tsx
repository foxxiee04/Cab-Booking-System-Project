import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Grid,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  CircularProgress,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import {
  DirectionsCar,
  LocalTaxi,
  AirportShuttle,
  Payment,
  CreditCard,
  AccountBalanceWallet,
  MoneyOff,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<'ECONOMY' | 'COMFORT' | 'PREMIUM'>('ECONOMY');
  const [selectedPayment, setSelectedPayment] = useState<'CASH' | 'CARD' | 'WALLET'>('CASH');
  const [priceEstimates, setPriceEstimates] = useState<Record<string, PriceEstimate>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const steps = ['Select Vehicle', 'Payment Method', 'Confirm'];

  // Fetch price estimates for all vehicle types
  useEffect(() => {
    if (open && pickup && dropoff) {
      fetchPriceEstimates();
    }
  }, [open, pickup, dropoff]);

  const fetchPriceEstimates = async () => {
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
  };

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
            <Typography variant="h6" gutterBottom>
              Choose your ride
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
                        borderColor:
                          selectedVehicle === vehicle.type ? 'primary.main' : 'divider',
                      }}
                      onClick={() => setSelectedVehicle(vehicle.type)}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={2}>
                            <Box color="primary.main">{vehicle.icon}</Box>
                            <Box>
                              <Typography variant="h6">{vehicle.name}</Typography>
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
              Payment Method
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
                    sx={{ mb: 2, cursor: 'pointer' }}
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
              Confirm Your Ride
            </Typography>
            <Card variant="outlined">
              <CardContent>
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Pickup
                  </Typography>
                  <Typography>{pickup.address || 'Selected location'}</Typography>
                </Box>
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Dropoff
                  </Typography>
                  <Typography>{dropoff.address || 'Selected location'}</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Vehicle</Typography>
                  <Typography fontWeight="bold">
                    {vehicleOptions.find((v) => v.type === selectedVehicle)?.name}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Payment</Typography>
                  <Typography fontWeight="bold">
                    {paymentOptions.find((p) => p.method === selectedPayment)?.label}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="h6">Total Fare</Typography>
                  <Typography variant="h6" color="primary">
                    {selectedEstimate && formatCurrency(selectedEstimate.fare)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            <Alert severity="info" sx={{ mt: 2 }}>
              We'll find the nearest available driver for you. This usually takes less than a
              minute.
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>
      <DialogContent>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={creating}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={creating}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={loading || !selectedEstimate}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleConfirmBooking}
            variant="contained"
            disabled={creating || loading}
          >
            {creating ? <CircularProgress size={24} /> : 'Confirm & Find Driver'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RideBookingFlow;
