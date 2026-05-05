import axiosInstance from './axios.config';

export interface RideReview {
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

interface RideReviewsResponse {
  success: boolean;
  count: number;
  reviews: RideReview[];
}

interface CreateReviewResponse {
  success: boolean;
  review: RideReview;
}

export const reviewApi = {
  getRideReviews: async (rideId: string): Promise<RideReviewsResponse> => {
    const response = await axiosInstance.get(`/reviews/ride/${rideId}`);
    return response.data;
  },

  createRideReview: async (payload: {
    rideId: string;
    bookingId?: string;
    revieweeId: string;
    revieweeName: string;
    rating: number;
    comment?: string;
    tags?: string[];
  }): Promise<CreateReviewResponse> => {
    const response = await axiosInstance.post('/reviews', {
      ...payload,
      type: 'CUSTOMER_TO_DRIVER',
      bookingId: payload.bookingId || payload.rideId,
    });

    return response.data;
  },

  getMyReviewForRide: async (rideId: string): Promise<RideReview | null> => {
    const response = await axiosInstance.get(`/reviews/ride/${rideId}`);
    const reviews: RideReview[] = response.data?.reviews ?? [];
    return reviews.find((r) => r.type === 'CUSTOMER_TO_DRIVER') ?? null;
  },
};