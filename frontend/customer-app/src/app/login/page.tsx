'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Car, Mail, Lock, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.login(data);
      console.log('🔐 Login response:', response);
      console.log('📦 Response data:', response.data);
      
      // Axios response.data = { success: true, data: { user, tokens } }
      const { user, tokens } = response.data.data;
      const { accessToken, refreshToken } = tokens;
      console.log('✅ Extracted:', { user, accessToken: accessToken?.substring(0, 20) + '...', refreshToken: refreshToken?.substring(0, 20) + '...' });
      
      login(user, accessToken, refreshToken);
      console.log('💾 Saved to store');
      
      router.push('/book');
    } catch (err: any) {
      console.error('❌ Login error:', err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Đăng nhập thất bại'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-primary-600">
            <Car className="w-10 h-10" />
            <span className="text-2xl font-bold">CabBooking</span>
          </Link>
        </div>

        {/* Form Card */}
        <Card className="p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Đăng nhập
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  {...register('email')}
                  type="email"
                  className="pl-10"
                  placeholder="email@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  {...register('password')}
                  type="password"
                  className="pl-10"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>

          <p className="mt-6 text-center text-gray-600">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-primary-600 font-medium hover:underline">
              Đăng ký ngay
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
