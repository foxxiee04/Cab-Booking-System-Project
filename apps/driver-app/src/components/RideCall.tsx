import React from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Drawer,
  Stack,
  Typography,
} from '@mui/material';
import { CallEnd, GraphicEq, Phone, PhoneInTalk } from '@mui/icons-material';
import { CallState } from '../hooks/useWebRTCCall';

interface RideCallProps {
  callState: CallState;
  callError: string | null;
  contactName?: string;
  onStart: () => void;
  onAccept: () => void;
  onHangUp: () => void;
  onClose: () => void;
  embedded?: boolean;
  showIdleButton?: boolean;
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
  contactName,
  onStart,
  onAccept,
  onHangUp,
  onClose,
  embedded = false,
  showIdleButton = true,
}) => {
  const open = callState !== 'idle';
  const avatarLabel = contactName?.[0] || 'L';

  const callBody = (
    <Stack alignItems="center" spacing={2.5} sx={{ pt: embedded ? 0 : 1, px: embedded ? 2.5 : 0, pb: embedded ? 2.5 : 0 }}>
      <Typography variant="subtitle1" fontWeight={800}>
        Cuộc gọi chuyến đi
      </Typography>

      <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 28 }}>
        {avatarLabel}
      </Avatar>

      <Box>
        <Typography variant="h6" fontWeight={800} textAlign="center">
          {contactName || 'Liên hệ chuyến đi'}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {CALL_STATE_LABELS[callState]}
        </Typography>
      </Box>

      {callState === 'active' && (
        <GraphicEq color="primary" sx={{ fontSize: 40 }} />
      )}

      {callState === 'calling' && <CircularProgress size={32} />}

      {callError && (
        <Typography variant="body2" color="error" sx={{ maxWidth: 240, textAlign: 'center' }}>
          {callError}
        </Typography>
      )}

      <Stack alignItems="center" spacing={2} sx={{ pt: 1 }}>
        <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
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
    </Stack>
  );

  if (embedded) {
    if (callState === 'idle' && !showIdleButton) {
      return null;
    }

    return (
      <Box
        sx={{
          borderTop: '1px solid rgba(226,232,240,0.9)',
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
          py: 2.5,
        }}
      >
        {callBody}
        {showIdleButton && callState === 'idle' && (
          <Box sx={{ px: 2.5, pt: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PhoneInTalk />}
              sx={{ borderRadius: 3, py: 1.2 }}
              onClick={onStart}
            >
              Gọi
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <>
      {/* The "Gọi" trigger button is rendered by the parent; this component owns the dialog */}
      <Drawer
        anchor="right"
        open={open}
        onClose={callState === 'active' ? undefined : onClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 360, md: 400 },
            borderTopLeftRadius: { xs: 24, sm: 28 },
            borderBottomLeftRadius: { xs: 0, sm: 28 },
            px: 3,
            py: 2.5,
            borderLeft: '1px solid rgba(148,163,184,0.18)',
            textAlign: 'center',
          },
        }}
      >
        {callBody}
      </Drawer>

      {/* Floating "start call" button shown outside dialog — caller triggers onStart */}
      {showIdleButton && callState === 'idle' && (
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
