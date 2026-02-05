import React from 'react';
import { Box, Container, Typography } from '@mui/material';

const Profile: React.FC = () => {
  return (
    <Container>
      <Box sx={{ py: 4 }}>
        <Typography variant="h4">Profile</Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          TODO: Implement profile page with user information and settings
        </Typography>
      </Box>
    </Container>
  );
};

export default Profile;
