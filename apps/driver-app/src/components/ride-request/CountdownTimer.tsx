import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface CountdownTimerProps {
  seconds: number;
  totalSeconds: number;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  seconds,
  totalSeconds,
}) => {
  const { t } = useTranslation();

  const getColor = () => {
    const progress = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;
    if (progress > 50) return '#4CAF50'; // Green
    if (progress > 25) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  return (
    <Box sx={{ textAlign: 'center', my: 2 }}>
      <Typography
        variant="h2"
        sx={{
          fontWeight: 'bold',
          color: getColor(),
          fontFamily: 'monospace',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {Math.max(0, seconds)}s
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.9 }}>
        {t('rideRequest.timeToAccept')}
      </Typography>
    </Box>
  );
};

export default CountdownTimer;
