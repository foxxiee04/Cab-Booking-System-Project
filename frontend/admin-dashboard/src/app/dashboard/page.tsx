'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Car, DollarSign, TrendingUp, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { ApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, accessToken, refreshToken, setTokens, logout } = useAuthStore();
  
  const [drivers, setDrivers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const api = new ApiClient({
    getTokens: () => (accessToken && refreshToken ? { accessToken, refreshToken } : null),
    setTokens: (tokens) => setTokens(tokens.accessToken, tokens.refreshToken),
    onLogout: logout,
  });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    loadData();
  }, [isAuthenticated, user]);

  const loadData = async () => {
    try {
      const [driversRes, ridesRes, usersRes] = await Promise.all([
        api.getAllDrivers(1, 20).catch(() => ({ data: { data: [] } })),
        api.getAllRides(1, 20).catch(() => ({ data: { data: [] } })),
        api.getAllUsers(1, 20).catch(() => ({ data: { data: [] } })),
      ]);

      setDrivers(driversRes.data.data || []);
      setRides(ridesRes.data.data || []);
      setUsers(usersRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDriver = async (driverId: string, verified: boolean) => {
    try {
      await api.verifyDriver(driverId, verified);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật trạng thái');
    }
  };

  if (!isAuthenticated || user?.role !== 'ADMIN') return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <Button variant="secondary" onClick={() => { logout(); router.push('/'); }}>
            Đăng xuất
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">Đang tải...</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tổng chuyến đi</p>
                    <p className="text-2xl font-bold">{rides.length}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tài xế</p>
                    <p className="text-2xl font-bold">{drivers.length}</p>
                  </div>
                  <Car className="w-8 h-8 text-green-600" />
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Người dùng</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Doanh thu</p>
                    <p className="text-2xl font-bold">0 ₫</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-yellow-600" />
                </div>
              </Card>
            </div>

            {/* Drivers */}
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Tài xế ({drivers.length})</h2>
              {drivers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Chưa có tài xế</p>
              ) : (
                <div className="space-y-3">
                  {drivers.map((driver) => (
                    <div key={driver.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{driver.vehiclePlate}</div>
                        <div className="text-sm text-gray-600">
                          {driver.vehicleBrand} {driver.vehicleModel} • {driver.vehicleType}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          driver.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          driver.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {driver.status}
                        </span>
                        {driver.status === 'PENDING' && (
                          <Button
                            size="sm"
                            onClick={() => handleVerifyDriver(driver.id, true)}
                          >
                            Duyệt
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Rides */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Chuyến đi gần đây ({rides.length})</h2>
              {rides.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Chưa có chuyến đi</p>
              ) : (
                <div className="space-y-3">
                  {rides.slice(0, 10).map((ride) => (
                    <div key={ride.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {ride.pickupAddress} → {ride.dropoffAddress}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(ride.createdAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-green-600">
                          {ride.fare?.toLocaleString('vi-VN')} ₫
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          ride.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          ride.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {ride.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
