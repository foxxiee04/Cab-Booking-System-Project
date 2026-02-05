import React from 'react';
import { Box, Typography } from '@mui/material';

const Logs: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        System Logs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        TODO: Implement logs viewer with filtering and search
      </Typography>
    </Box>
  );
};

export default Logs;
