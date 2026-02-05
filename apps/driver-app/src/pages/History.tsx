import React from 'react';
import { Container, Box, Typography } from '@mui/material';

const History: React.FC = () => {
  return (
    <Container>
      <Box sx={{ py: 4 }}>
        <Typography variant="h4">Ride History</Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          TODO: Implement ride history with completed rides list
        </Typography>
      </Box>
    </Container>
  );
};

export default History;
