'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({ title, value, icon, trend, className }: StatsCardProps) {
  return (
    <Card className={`${className} hover:shadow-lg transition-shadow`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </CardTitle>
          <div className="text-gray-400 dark:text-gray-600">
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </span>
          
          {trend && (
            <span className={`text-sm font-medium ${
              trend.isPositive ? 'text-success' : 'text-error'
            }`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}