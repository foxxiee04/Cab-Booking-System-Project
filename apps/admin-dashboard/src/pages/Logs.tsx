import React, { useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, InputAdornment, MenuItem, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { SearchRounded } from '@mui/icons-material';
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
  const [keyword, setKeyword] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.getLogs({
          level: levelFilter === 'ALL' ? undefined : levelFilter,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        const logs = (response.data?.logs || []).map((log: any, index: number) => ({
          ...log,
          __id: log.id || `log-${page * PAGE_SIZE + index}`,
        }));
        setRows(logs);
        setTotal(response.data?.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadLogs'));
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [levelFilter, page, t]);

  const filteredRows = keyword.trim()
    ? rows.filter((log) => (
        [log.id, log.level, log.service, log.message]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      ))
    : rows;

  const summary = filteredRows.reduce((acc, log) => {
    acc.total += 1;
    const level = (log.level || '').toUpperCase();
    if (level === 'ERROR') acc.error += 1;
    if (level === 'WARN' || level === 'WARNING') acc.warning += 1;
    if (level === 'INFO') acc.info += 1;
    return acc;
  }, { total: 0, error: 0, warning: 0, info: 0 });

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
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(239,68,68,0.08), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900}>
        {t('tables.logs')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        Gom log hệ thống theo mức độ ưu tiên để rà soát nhanh các sự cố đang diễn ra hoặc các luồng cần kiểm tra thêm.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
        {[
          { label: 'ERROR', value: summary.error, color: '#dc2626' },
          { label: 'WARNING', value: summary.warning, color: '#d97706' },
          { label: 'INFO', value: summary.info, color: '#0284c7' },
        ].map((item) => (
          <Card key={item.label} elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: item.color }}>{item.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 220px' } }}>
            <TextField
              size="small"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm theo service, cấp độ hoặc nội dung log"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              size="small"
              label="Mức độ"
              value={levelFilter}
              onChange={(event) => {
                setPage(0);
                setLevelFilter(event.target.value);
              }}
            >
              <MenuItem value="ALL">Tất cả</MenuItem>
              <MenuItem value="ERROR">ERROR</MenuItem>
              <MenuItem value="WARN">WARN</MenuItem>
              <MenuItem value="INFO">INFO</MenuItem>
            </TextField>
          </Box>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 1.5 }}>
          <Box sx={{ height: 540 }}>
            <DataGrid
              rows={filteredRows}
              columns={columns}
              rowCount={levelFilter === 'ALL' && !keyword.trim() ? total : filteredRows.length}
              loading={loading}
              paginationMode="server"
              pageSizeOptions={[PAGE_SIZE]}
              paginationModel={{ page, pageSize: PAGE_SIZE }}
              onPaginationModelChange={(model) => setPage(model.page)}
              getRowId={(row) => row.__id}
              disableRowSelectionOnClick
              sx={{ border: 0 }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Logs;
