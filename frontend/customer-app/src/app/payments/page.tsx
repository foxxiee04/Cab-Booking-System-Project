'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Car } from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | string;

type Payment = {
  id: string;
  rideId: string;
  amount: number;
  currency: string;
  method: string;
  status: PaymentStatus;
  createdAt?: string;
  completedAt?: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN');
}

function statusToBadge(status: PaymentStatus) {
  switch (status) {
    case 'COMPLETED':
      return { variant: 'success' as const, label: 'Thành công' };
    case 'FAILED':
      return { variant: 'danger' as const, label: 'Thất bại' };
    case 'REFUNDED':
      return { variant: 'warning' as const, label: 'Đã hoàn tiền' };
    case 'PROCESSING':
      return { variant: 'info' as const, label: 'Đang xử lý' };
    case 'PENDING':
    default:
      return { variant: 'default' as const, label: status === 'PENDING' ? 'Chờ xử lý' : String(status) };
  }
}

export default function CustomerPaymentHistoryPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.getPaymentHistory(1, 20);
        const list: Payment[] = res.data?.data?.payments || res.data?.data || [];
        if (mounted) setPayments(list);
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.message || 'Không thể tải lịch sử thanh toán');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <Card>
          <CardContent className="p-6 text-sm text-gray-600">Đang tải...</CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="p-6 text-sm text-red-600">{error}</CardContent>
        </Card>
      );
    }

    if (!payments.length) {
      return (
        <Card>
          <CardContent className="p-6 text-sm text-gray-600">Chưa có thanh toán nào.</CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {payments.map((p) => {
          const badge = statusToBadge(p.status);
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Ride #{p.rideId.slice(0, 8)}</CardTitle>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="text-gray-600 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span>{String(p.method)}</span>
                    <span className="text-gray-400">•</span>
                    <span>{formatDate(p.completedAt || p.createdAt)}</span>
                  </div>
                  <div className="font-semibold text-gray-900">{formatCurrency(p.amount)}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }, [loading, error, payments]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary-600">
          <Car className="w-6 h-6" />
          <span className="font-bold">CabBooking</span>
        </div>
        <Link href="/book">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Lịch sử thanh toán</h1>
        {content}
      </main>
    </div>
  );
}
