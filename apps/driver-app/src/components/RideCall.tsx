import React from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import { CallEnd, GraphicEq, Phone, PhoneInTalk } from '@mui/icons-material';
import { CallState } from '../hooks/useWebRTCCall';

interface RideCallProps {
  callState: CallState;
  callError: string | null;
  driverName?: string;
  onStart: () => void;
  onAccept: () => void;
  onHangUp: () => void;
  onClose: () => void;
}

const CALL_STATE_LABELS: Record<CallState, string> = {
  idle: 'Gọi điện',
  calling: 'Đang gọi...',
  incoming: 'Cuộc gọi đến',
  active: 'Đang trong cuộc gọi',
  ended: 'Cuộc gọi đã kết thúc',
};

const RideCall: React.FC<RideCallProps> = ({
  callState,
  callError,
  driverName,
  onStart,
  onAccept,
  onHangUp,
  onClose,
}) => {
  const open = callState !== 'idle';

  return (
    <>
      {/* The "Gọi" trigger button is rendered by the parent; this component owns the dialog */}
      <Dialog
        open={open}
        onClose={callState === 'active' ? undefined : onClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 5, textAlign: 'center', pb: 3 } }}
      >
        <DialogContent>
          <Stack alignItems="center" spacing={2} sx={{ pt: 1 }}>
            {/* Avatar */}
            <Avatar sx={{ width: 80, height: 80, bgcolor: '#1d4ed8', fontSize: 28 }}>
              {driverName?.[0] || 'TX'}
            </Avatar>

            <Box>
              <Typography variant="h6" fontWeight={800}>
                {driverName || 'Tài xế'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {CALL_STATE_LABELS[callState]}
              </Typography>
            </Box>

            {/* Animated waveform when active */}
            {callState === 'active' && (
              <GraphicEq color="primary" sx={{ fontSize: 40 }} />
            )}

            {/* Spinner when calling */}
            {callState === 'calling' && <CircularProgress size={32} />}

            {callError && (
              <Typography variant="body2" color="error" sx={{ maxWidth: 240 }}>
                {callError}
              </Typography>
            )}

            {/* Buttons */}
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              {callState === 'incoming' && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<Phone />}
                    onClick={onAccept}
                    sx={{ borderRadius: 3, px: 3 }}
                  >
                    Nghe
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<CallEnd />}
                    onClick={onHangUp}
                    sx={{ borderRadius: 3, px: 3 }}
                  >
                    Từ chối
                  </Button>
                </>
              )}

              {(callState === 'calling' || callState === 'active') && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<CallEnd />}
                  onClick={onHangUp}
                  sx={{ borderRadius: 3, px: 4 }}
                >
                  Kết thúc
                </Button>
              )}

              {callState === 'ended' && (
                <Button variant="outlined" onClick={onClose} sx={{ borderRadius: 3 }}>
                  Đóng
                </Button>
              )}
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Floating "start call" button shown outside dialog — caller triggers onStart */}
      {callState === 'idle' && (
        <Button
          variant="outlined"
          fullWidth
          startIcon={<PhoneInTalk />}
          sx={{ borderRadius: 3, py: 1.2 }}
          onClick={onStart}
        >
          Gọi
        </Button>
      )}
    </>
  );
};

export default RideCall;
