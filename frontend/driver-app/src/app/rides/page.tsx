'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { ApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function RidesPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, refreshToken, setTokens, logout } = useAuthStore();
  
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const api = new ApiClient({
    getTokens: () => (accessToken && refreshToken ? { accessToken, refreshToken } : null),
    setTokens: (tokens) => setTokens(tokens.accessToken, tokens.refreshToken),
    onLogout: logout,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadRides();
  }, [isAuthenticated]);

  const loadRides = async () => {
    try {
      const res = await api.getRideHistory(1, 50);
      setRides(res.data.data.rides || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải lịch sử');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Lịch sử chuyến đi</h1>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Dashboard
            </Button>
            <Button variant="secondary" onClick={() => { logout(); router.push('/'); }}>
              Đăng xuất
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">Đang tải...</div>
        ) : rides.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500 mb-4">Bạn chưa có chuyến đi nào</p>
            <Button onClick={() => router.push('/dashboard')}>Về Dashboard</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {rides.map((ride) => (
              <Card key={ride.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ride.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        ride.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {ride.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(ride.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {ride.fare?.toLocaleString('vi-VN')} ₫
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-green-500 mt-1" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">Điểm đón</div>
                      <div className="text-sm">{ride.pickupAddress || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Navigation className="w-4 h-4 text-red-500 mt-1" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">Điểm đến</div>
                      <div className="text-sm">{ride.dropoffAddress || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
