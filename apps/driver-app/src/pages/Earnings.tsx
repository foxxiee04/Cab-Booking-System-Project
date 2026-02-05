import React from 'react';
import { Container, Box, Typography } from '@mui/material';

const Earnings: React.FC = () => {
  return (
    <Container>
      <Box sx={{ py: 4 }}>
        <Typography variant="h4">Earnings</Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          TODO: Implement earnings page with daily/weekly/monthly breakdown
        </Typography>
      </Box>
    </Container>
  );
};

export default Earnings;
