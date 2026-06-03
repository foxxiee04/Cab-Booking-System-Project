import axiosInstance from './axios.config';

export interface DriverReview {
  _id?: string;
  rideId: string;
  bookingId?: string;
  type: 'CUSTOMER_TO_DRIVER' | 'DRIVER_TO_CUSTOMER';
  reviewerId?: string;
  reviewerName?: string;
  revieweeId: string;
  revieweeName: string;
  rating: number;
  comment?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}

export const reviewApi = {
  getReceivedReviews: async (driverId: string, limit = 50): Promise<{ success: boolean; count: number; reviews: DriverReview[] }> => {
    const response = await axiosInstance.get(`/reviews/received/${driverId}`, { params: { limit } });
    return response.data;
  },

  getDriverStats: async (driverId: string): Promise<{ success: boolean; driverId: string; stats: DriverReviewStats }> => {
    const response = await axiosInstance.get(`/reviews/driver/${driverId}/stats`);
    return response.data;
  },
};
