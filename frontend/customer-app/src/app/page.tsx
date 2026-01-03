'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { Car, MapPin, Clock, Shield } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/book');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-700">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-white">
          <Car className="w-8 h-8" />
          <span className="text-xl font-bold">CabBooking</span>
        </div>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-white text-primary-600 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            Đăng ký
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-6">
            Di chuyển dễ dàng, an toàn
          </h1>
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Đặt xe nhanh chóng với hệ thống AI thông minh, 
            theo dõi chuyến đi realtime và thanh toán tiện lợi.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-white text-primary-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg"
          >
            Bắt đầu ngay
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
            <MapPin className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Định vị chính xác</h3>
            <p className="text-white/70">
              Xác định vị trí của bạn và điểm đến một cách chính xác trên bản đồ.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
            <Clock className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Theo dõi realtime</h3>
            <p className="text-white/70">
              Theo dõi vị trí tài xế và thời gian đến trong thời gian thực.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
            <Shield className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">An toàn & bảo mật</h3>
            <p className="text-white/70">
              Thông tin cá nhân được bảo mật, tài xế được xác minh.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
