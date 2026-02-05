import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

interface CountdownTimerProps {
  seconds: number;
  totalSeconds: number;
  onTick?: (remainingSeconds: number) => void;
  onComplete?: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  seconds,
  totalSeconds,
  onTick,
  onComplete,
}) => {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    setTimeLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        onTick?.(newTime);
        
        if (newTime <= 0) {
          clearInterval(timer);
          onComplete?.();
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTick, onComplete]);

  const getColor = () => {
    const progress = (timeLeft / totalSeconds) * 100;
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
        {timeLeft}s
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.9 }}>
        Time to accept
      </Typography>
    </Box>
  );
};

export default CountdownTimer;
