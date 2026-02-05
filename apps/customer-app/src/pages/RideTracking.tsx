// Placeholder pages - Will be implemented later

import React from 'react';
import { Box, Container, Typography } from '@mui/material';

export const RideTracking: React.FC = () => {
  return (
    <Container>
      <Box sx={{ py: 4 }}>
        <Typography variant="h4">Ride Tracking</Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          TODO: Implement ride tracking page with real-time driver location updates
        </Typography>
      </Box>
    </Container>
  );
};

export default RideTracking;
