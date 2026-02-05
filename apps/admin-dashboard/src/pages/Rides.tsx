import React from 'react';
import { Box, Typography } from '@mui/material';

const Rides: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        Rides Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        TODO: Implement rides table with filters and details
      </Typography>
    </Box>
  );
};

export default Rides;
