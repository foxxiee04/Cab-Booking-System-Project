'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import {
  LayoutDashboard,
  Users,
  Car,
  MapPin,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

// Mock data for demonstration
const mockStats = {
  totalUsers: 15420,
  totalDrivers: 892,
  activeRides: 156,
  todayRevenue: 45680000,
  todayRides: 1234,
  completionRate: 94.5,
  avgRating: 4.7,
  userGrowth: 12.5,
  revenueGrowth: 8.3,
};

const mockRecentRides = [
  { id: 'R001', customer: 'Nguyễn Văn A', driver: 'Trần Văn B', status: 'COMPLETED', fare: 125000, time: '10 phút trước' },
  { id: 'R002', customer: 'Lê Thị C', driver: 'Phạm Văn D', status: 'IN_PROGRESS', fare: 85000, time: '15 phút trước' },
  { id: 'R003', customer: 'Hoàng Văn E', driver: 'Ngô Thị F', status: 'PENDING', fare: 95000, time: '20 phút trước' },
  { id: 'R004', customer: 'Đỗ Văn G', driver: 'Vũ Thị H', status: 'CANCELLED', fare: 0, time: '25 phút trước' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [stats, setStats] = useState(mockStats);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch {}
    logout();
    router.push('/');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-700',
      IN_PROGRESS: 'bg-blue-100 text-blue-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      CANCELLED: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      COMPLETED: 'Hoàn thành',
      IN_PROGRESS: 'Đang đi',
      PENDING: 'Chờ',
      CANCELLED: 'Đã hủy',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <LayoutDashboard className="w-8 h-8 text-primary-500" />
            <span className="text-xl font-bold">Admin</span>
          </div>

          <nav className="space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-lg text-white"
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/users"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
            >
              <Users className="w-5 h-5" />
              Người dùng
            </Link>
            <Link
              href="/dashboard/drivers"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
            >
              <Car className="w-5 h-5" />
              Tài xế
            </Link>
            <Link
              href="/dashboard/rides"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
            >
              <MapPin className="w-5 h-5" />
              Chuyến đi
            </Link>
            <Link
              href="/dashboard/payments"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
            >
              <DollarSign className="w-5 h-5" />
              Thanh toán
            </Link>
            <Link
              href="/dashboard/reports"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
            >
              <BarChart3 className="w-5 h-5" />
              Báo cáo
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
            >
              <Settings className="w-5 h-5" />
              Cài đặt
            </Link>
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 w-64 p-6 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition"
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-600">Xin chào, {user?.name}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <TrendingUp className="w-4 h-4" />
                +{stats.userGrowth}%
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.totalUsers.toLocaleString()}</p>
            <p className="text-gray-500 text-sm">Tổng người dùng</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Car className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">{stats.activeRides} đang hoạt động</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.totalDrivers.toLocaleString()}</p>
            <p className="text-gray-500 text-sm">Tổng tài xế</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <MapPin className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                {stats.completionRate}%
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.todayRides.toLocaleString()}</p>
            <p className="text-gray-500 text-sm">Chuyến hôm nay</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <TrendingUp className="w-4 h-4" />
                +{stats.revenueGrowth}%
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.todayRevenue)}</p>
            <p className="text-gray-500 text-sm">Doanh thu hôm nay</p>
          </div>
        </div>

        {/* Recent Rides Table */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800">Chuyến đi gần đây</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tài xế</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giá</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mockRecentRides.map((ride) => (
                  <tr key={ride.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-primary-600">{ride.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{ride.customer}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{ride.driver}</td>
                    <td className="px-6 py-4">{getStatusBadge(ride.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{formatCurrency(ride.fare)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{ride.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t">
            <Link href="/dashboard/rides" className="text-primary-600 text-sm font-medium hover:underline">
              Xem tất cả chuyến đi →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
