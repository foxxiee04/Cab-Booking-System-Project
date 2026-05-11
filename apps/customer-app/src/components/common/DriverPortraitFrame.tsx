import React from 'react';
import { Avatar, Box, Typography } from '@mui/material';

export interface DriverPortraitFrameProps {
  src?: string | null;
  initials?: string;
  alt?: string;
  width?: number;
  borderRadius?: number;
  onClick?: () => void;
  bordered?: boolean;
}

/** Ảnh chân dung tài xế 3×4 (theo avatar hồ sơ). */
export const DriverPortraitFrame: React.FC<DriverPortraitFrameProps> = ({
  src,
  initials = '?',
  alt = 'Tài xế',
  width = 56,
  borderRadius = 2,
  onClick,
  bordered = true,
}) => {
  const h = Math.round((width * 4) / 3);
  const commonSx = {
    width,
    minWidth: width,
    height: h,
    borderRadius,
    flexShrink: 0,
    overflow: 'hidden',
    bgcolor: 'action.hover',
    border: bordered ? '2px solid' : undefined,
    borderColor: bordered ? 'divider' : undefined,
    cursor: onClick ? 'pointer' : undefined,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  if (src) {
    return (
      <Box
        component={onClick ? 'button' : 'div'}
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        sx={{
          ...commonSx,
          p: 0,
          border: bordered ? '2px solid' : undefined,
          borderColor: bordered ? 'divider' : undefined,
          bgcolor: '#fff',
        }}
      >
        <Box component="img" src={src} alt={alt} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </Box>
    );
  }

  return (
    <Box
      component={onClick ? 'button' : 'div'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      sx={commonSx}
    >
      <Typography variant="caption" fontWeight={800} color="text.secondary">
        {initials.slice(0, 2)}
      </Typography>
    </Box>
  );
};

export const DriverPortraitAvatar: React.FC<{
  src?: string | null;
  initials?: string;
  size?: number;
}> = ({ src, initials = '?', size = 40 }) => (
  <Avatar
    src={src || undefined}
    variant="rounded"
    sx={{
      width: Math.round((size * 3) / 4),
      height: size,
      borderRadius: 1.25,
      fontWeight: 800,
      bgcolor: '#1d4ed8',
      fontSize: Math.max(12, Math.round(size * 0.28)),
    }}
  >
    {initials[0]}
  </Avatar>
);
