import React from 'react';
import { Box, Typography } from '@mui/material';

const Payments: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        Payments Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        TODO: Implement payments table with status and transaction details
      </Typography>
    </Box>
  );
};

export default Payments;
