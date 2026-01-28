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
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center backdrop-blur-sm bg-white/10">
        <div className="flex items-center gap-2 text-white">
          <Car className="w-8 h-8" />
          <span className="text-xl font-bold">CabBooking</span>
        </div>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-6 py-2.5 text-white hover:bg-white/10 rounded-lg transition-all font-medium"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="px-6 py-2.5 bg-white text-primary-600 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl"
          >
            Đăng ký
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center text-white animate-smooth">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Di chuyển dễ dàng,<br />an toàn và tiện lợi
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
            Đặt xe nhanh chóng với hệ thống AI thông minh, 
            theo dõi chuyến đi realtime trên bản đồ và thanh toán tiện lợi.
          </p>
          <Link
            href="/register"
            className="inline-block px-10 py-4 bg-white text-primary-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-2xl hover:shadow-xl hover:scale-105"
          >
            Bắt đầu ngay
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-24">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-white hover:bg-white/20 transition-all hover:scale-105 transform">
            <MapPin className="w-14 h-14 mb-4" />
            <h3 className="text-2xl font-semibold mb-3">Định vị chính xác</h3>
            <p className="text-white/80 leading-relaxed">
              Tìm kiếm và chọn điểm đón, điểm đến dễ dàng với hệ thống gợi ý thông minh trên bản đồ TrackAsia.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-white hover:bg-white/20 transition-all hover:scale-105 transform">
            <Clock className="w-14 h-14 mb-4" />
            <h3 className="text-2xl font-semibold mb-3">Theo dõi realtime</h3>
            <p className="text-white/80 leading-relaxed">
              Xem vị trí tài xế, thời gian đến và toàn bộ hành trình trên bản đồ trong thời gian thực.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-white hover:bg-white/20 transition-all hover:scale-105 transform">
            <Shield className="w-14 h-14 mb-4" />
            <h3 className="text-2xl font-semibold mb-3">An toàn & bảo mật</h3>
            <p className="text-white/80 leading-relaxed">
              Thông tin cá nhân được mã hóa bảo mật, tài xế được xác minh và đánh giá nghiêm ngặt.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
