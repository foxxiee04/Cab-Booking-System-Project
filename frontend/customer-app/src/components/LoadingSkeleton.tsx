'use client';

export function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 animate-pulse">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
          </div>
          <div className="w-20 h-8 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
      ))}
    </div>
  );
}