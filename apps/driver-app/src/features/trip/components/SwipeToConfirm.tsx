import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EastRoundedIcon from '@mui/icons-material/EastRounded';

interface SwipeToConfirmProps {
  label: string;
  actionLabel?: string;
  confirmLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  testId?: string;
  actionButtonTestId?: string;
}

const THUMB_SIZE = 52;
const PADDING = 6;
const CONFIRM_THRESHOLD = 0.82;

export const SwipeToConfirm: React.FC<SwipeToConfirmProps> = ({
  label,
  actionLabel = 'Nhận chuyến',
  confirmLabel = 'Đã nhận chuyến',
  disabled = false,
  loading = false,
  onConfirm,
  testId,
  actionButtonTestId,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ active: false, startX: 0, startOffset: 0 });
  const [offset, setOffset] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  const maxOffset = Math.max(0, (trackRef.current?.clientWidth || 0) - THUMB_SIZE - PADDING * 2);

  useEffect(() => {
    if (!loading) {
      return;
    }
    setConfirmed(true);
  }, [loading]);

  useEffect(() => {
    if (!confirmed || loading) {
      return;
    }
    const timer = window.setTimeout(() => {
      setOffset(0);
      setConfirmed(false);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [confirmed, loading]);

  const triggerConfirm = useCallback(() => {
    if (disabled || loading || confirmed) {
      return;
    }

    setOffset(maxOffset);
    setConfirmed(true);
    onConfirm();
  }, [confirmed, disabled, loading, maxOffset, onConfirm]);

  useEffect(() => {
    const handleMove = (event: MouseEvent | TouchEvent) => {
      if (!dragStateRef.current.active || disabled || loading || confirmed) {
        return;
      }

      const clientX = 'touches' in event ? event.touches[0]?.clientX ?? dragStateRef.current.startX : event.clientX;
      const next = dragStateRef.current.startOffset + (clientX - dragStateRef.current.startX);
      setOffset(Math.max(0, Math.min(maxOffset, next)));
    };

    const handleEnd = () => {
      if (!dragStateRef.current.active) {
        return;
      }

      dragStateRef.current.active = false;
      const progress = maxOffset === 0 ? 0 : offset / maxOffset;

      if (progress >= CONFIRM_THRESHOLD) {
        triggerConfirm();
        return;
      }

      setOffset(0);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [confirmed, disabled, loading, maxOffset, offset, triggerConfirm]);

  const startDrag = (clientX: number) => {
    if (disabled || loading || confirmed) {
      return;
    }
    dragStateRef.current = { active: true, startX: clientX, startOffset: offset };
  };

  const progress = maxOffset === 0 ? 0 : offset / maxOffset;

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <Box
        ref={trackRef}
        data-testid={testId}
        sx={{
          position: 'relative',
          height: 64,
          borderRadius: 999,
          overflow: 'hidden',
          background: disabled
            ? 'linear-gradient(90deg, #cbd5e1 0%, #94a3b8 100%)'
            : 'linear-gradient(90deg, #0f766e 0%, #16a34a 100%)',
          boxShadow: '0 16px 30px rgba(22, 163, 74, 0.22)',
          userSelect: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            width: `${Math.max(18, progress * 100)}%`,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08))',
            transition: dragStateRef.current.active ? 'none' : 'width 180ms ease',
          }}
        />

        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            px: 8,
          }}
        >
          <Typography
            variant="subtitle1"
            fontWeight={800}
            color="common.white"
            sx={{ letterSpacing: 0.2, textAlign: 'center' }}
          >
            {confirmed ? confirmLabel : label}
          </Typography>
        </Box>

        <Box
          onMouseDown={(event) => startDrag(event.clientX)}
          onTouchStart={(event) => startDrag(event.touches[0].clientX)}
          sx={{
            position: 'absolute',
            top: PADDING,
            left: PADDING + offset,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: '50%',
            bgcolor: 'common.white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled || loading || confirmed ? 'default' : 'grab',
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.22)',
            transition: dragStateRef.current.active ? 'none' : 'left 180ms ease',
            zIndex: 2,
          }}
        >
          {loading ? (
            <CircularProgress size={24} color="success" />
          ) : confirmed ? (
            <CheckCircleRoundedIcon sx={{ color: '#16a34a' }} />
          ) : (
            <EastRoundedIcon sx={{ color: '#0f766e' }} />
          )}
        </Box>
      </Box>
      {/* Hidden button for E2E test automation — triggers the same confirm logic as the swipe gesture */}
      {actionButtonTestId && (
        <Button
          data-testid={actionButtonTestId}
          onClick={triggerConfirm}
          disabled={disabled || loading || confirmed}
          sx={{ position: 'absolute', opacity: 0, width: 0, height: 0, minWidth: 0, padding: 0, overflow: 'hidden' }}
          tabIndex={-1}
          aria-hidden="true"
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export default SwipeToConfirm;
