import React from 'react';
import { Box, Typography } from '@mui/material';

const Customers: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        Customers Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        TODO: Implement customers table with ride history and ratings
      </Typography>
    </Box>
  );
};

export default Customers;
