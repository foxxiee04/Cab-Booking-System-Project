'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Car, MapPin } from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RideStatus = 'PENDING' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;

type Ride = {
  id: string;
  status: RideStatus;
  pickupAddress: string;
  dropoffAddress: string;
  distance: number | null;
  duration: number | null;
  fare: number | null;
  requestedAt?: string;
  createdAt?: string;
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

function statusToBadge(status: RideStatus) {
  switch (status) {
    case 'COMPLETED':
      return { variant: 'success' as const, label: 'Hoàn thành' };
    case 'CANCELLED':
      return { variant: 'danger' as const, label: 'Đã huỷ' };
    case 'IN_PROGRESS':
      return { variant: 'info' as const, label: 'Đang di chuyển' };
    case 'ACCEPTED':
      return { variant: 'info' as const, label: 'Đã nhận' };
    case 'ASSIGNED':
      return { variant: 'warning' as const, label: 'Đã gán' };
    case 'PENDING':
    default:
      return { variant: 'default' as const, label: status === 'PENDING' ? 'Đang chờ' : String(status) };
  }
}

export default function DriverRideHistoryPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rides, setRides] = useState<Ride[]>([]);

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
        const res = await apiClient.getRideHistory(1, 20);
        const list: Ride[] = res.data?.data?.rides || [];
        if (mounted) setRides(list);
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.message || 'Không thể tải lịch sử chuyến');
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

    if (!rides.length) {
      return (
        <Card>
          <CardContent className="p-6 text-sm text-gray-600">Chưa có chuyến nào.</CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {rides.map((ride) => {
          const badge = statusToBadge(ride.status);
          return (
            <Card key={ride.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Chuyến #{ride.id.slice(0, 8)}</CardTitle>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-gray-700">
                    <MapPin className="mt-0.5 h-4 w-4 text-green-600" />
                    <span>{ride.pickupAddress}</span>
                  </div>
                  <div className="flex items-start gap-2 text-gray-700">
                    <MapPin className="mt-0.5 h-4 w-4 text-red-600" />
                    <span>{ride.dropoffAddress}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                    <div className="text-gray-600">{formatDate(ride.requestedAt || ride.createdAt)}</div>
                    <div className="font-semibold text-gray-900">
                      {typeof ride.fare === 'number' ? formatCurrency(ride.fare) : '—'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }, [loading, error, rides]);

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
        <h1 className="text-xl font-bold text-gray-900 mb-4">Lịch sử chuyến</h1>
        {content}
      </main>
    </div>
  );
}
