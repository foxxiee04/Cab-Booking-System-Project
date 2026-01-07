'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, DollarSign, Car } from 'lucide-react';

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
      return { variant: 'success' as const, label: 'Đã nhận' };
    case 'REFUNDED':
      return { variant: 'warning' as const, label: 'Hoàn tiền' };
    case 'FAILED':
      return { variant: 'danger' as const, label: 'Thất bại' };
    default:
      return { variant: 'default' as const, label: String(status) };
  }
}

export default function DriverEarningsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.getEarnings(1, 20);
        const payload = res.data?.data;
        const list: Payment[] = payload?.payments || [];
        if (mounted) {
          setPayments(list);
          setTotalEarnings(payload?.totalEarnings || 0);
        }
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.message || 'Không thể tải thu nhập');
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

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tổng thu nhập</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalEarnings)}</div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!payments.length ? (
            <Card>
              <CardContent className="p-6 text-sm text-gray-600">Chưa có khoản thu nào.</CardContent>
            </Card>
          ) : (
            payments.map((p) => {
              const badge = statusToBadge(p.status);
              return (
                <Card key={p.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <CardTitle className="text-base">Ride #{p.rideId.slice(0, 8)}</CardTitle>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="text-gray-600">
                        {formatDate(p.completedAt || p.createdAt)}
                      </div>
                      <div className="font-semibold text-gray-900">{formatCurrency(p.amount)}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  }, [loading, error, payments, totalEarnings]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary-600">
          <Car className="w-6 h-6" />
          <span className="font-bold">Driver</span>
        </div>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Thu nhập
        </h1>
        {content}
      </main>
    </div>
  );
}
