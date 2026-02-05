import React from 'react';
import { Box, Typography } from '@mui/material';

const Drivers: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        Drivers Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        TODO: Implement drivers table with status and performance metrics
      </Typography>
    </Box>
  );
};

export default Drivers;
