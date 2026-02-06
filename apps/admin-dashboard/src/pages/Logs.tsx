import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { formatDate } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

type SystemLog = {
  id?: string;
  level?: string;
  message?: string;
  service?: string;
  timestamp?: string;
  createdAt?: string;
  __id: string;
};

const PAGE_SIZE = 10;

const getLogLevelColor = (level?: string): 'default' | 'info' | 'warning' | 'error' => {
  const normalized = (level || '').toUpperCase();
  if (normalized === 'ERROR') return 'error';
  if (normalized === 'WARN' || normalized === 'WARNING') return 'warning';
  if (normalized === 'INFO') return 'info';
  return 'default';
};

const Logs: React.FC = () => {
  const [rows, setRows] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.getLogs({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        const logs = (response.data.logs || []).map((log: any, index: number) => ({
          ...log,
          __id: log.id || `log-${page * PAGE_SIZE + index}`,
        }));
        setRows(logs);
        setTotal(response.data.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadLogs'));
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [page]);

  const columns: GridColDef<SystemLog>[] = [
    {
      field: 'id',
      headerName: t('columns.logId'),
      flex: 1,
      minWidth: 180,
      valueFormatter: (params) => params.value || t('labels.na'),
    },
    {
      field: 'level',
      headerName: t('columns.level'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={(params.value || t('labels.unknown')).toUpperCase()}
          size="small"
          color={getLogLevelColor(params.value)}
        />
      ),
    },
    { field: 'service', headerName: t('columns.service'), width: 160 },
    { field: 'message', headerName: t('columns.message'), flex: 1, minWidth: 300 },
    {
      field: 'timestamp',
      headerName: t('columns.time'),
      width: 180,
      valueGetter: (params) => params.row.timestamp || params.row.createdAt,
      valueFormatter: (params) => (params.value ? formatDate(params.value) : t('labels.na')),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('tables.logs')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 2, height: 520 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          pageSizeOptions={[PAGE_SIZE]}
          paginationModel={{ page, pageSize: PAGE_SIZE }}
          onPaginationModelChange={(model) => setPage(model.page)}
          getRowId={(row) => row.__id}
        />
      </Box>
    </Box>
  );
};

export default Logs;
