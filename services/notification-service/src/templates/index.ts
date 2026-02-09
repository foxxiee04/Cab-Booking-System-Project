export const emailTemplates = {
  BOOKING_CREATED: {
    subject: 'Booking Confirmation - #{bookingId}',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">🚕 Booking Confirmed!</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your booking has been successfully created.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details:</h3>
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p><strong>Vehicle Type:</strong> ${data.vehicleType}</p>
          <p><strong>Pickup:</strong> ${data.pickupAddress}</p>
          <p><strong>Dropoff:</strong> ${data.dropoffAddress}</p>
          <p><strong>Estimated Fare:</strong> ${data.estimatedFare} VND</p>
        </div>
        <p>We'll notify you once a driver accepts your ride.</p>
        <p style="color: #666; font-size: 12px;">Thank you for choosing our service!</p>
      </div>
    `,
  },

  RIDE_ACCEPTED: {
    subject: 'Driver Assigned - #{bookingId}',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196F3;">🚗 Driver on the way!</h2>
        <p>Dear ${data.customerName},</p>
        <p>Great news! A driver has accepted your ride.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Driver Information:</h3>
          <p><strong>Driver:</strong> ${data.driverName}</p>
          <p><strong>Vehicle:</strong> ${data.vehicleMake} ${data.vehicleModel}</p>
          <p><strong>License Plate:</strong> ${data.licensePlate}</p>
          <p><strong>ETA:</strong> ${data.eta} minutes</p>
        </div>
        <p>Track your driver in real-time through the app.</p>
      </div>
    `,
  },

  RIDE_STARTED: {
    subject: 'Your Ride Has Started - #{bookingId}',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF9800;">🛣️ Ride in Progress</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your ride has started. Enjoy your journey!</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Started at:</strong> ${data.startTime}</p>
          <p><strong>Destination:</strong> ${data.destination}</p>
        </div>
      </div>
    `,
  },

  RIDE_COMPLETED: {
    subject: 'Ride Completed - #{bookingId}',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">✅ Ride Completed!</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your ride has been completed successfully.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Trip Summary:</h3>
          <p><strong>Distance:</strong> ${data.distance} km</p>
          <p><strong>Duration:</strong> ${data.duration} minutes</p>
          <p><strong>Final Fare:</strong> ${data.finalFare} VND</p>
        </div>
        <p>Please rate your driver and help us improve our service.</p>
        <p style="color: #666;">Thank you for riding with us!</p>
      </div>
    `,
  },

  PAYMENT_SUCCESSFUL: {
    subject: 'Payment Confirmed - #{bookingId}',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">💳 Payment Successful</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your payment has been processed successfully.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Amount:</strong> ${data.amount} VND</p>
          <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
          <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
          <p><strong>Date:</strong> ${data.paymentDate}</p>
        </div>
        <p>Receipt has been sent to your email.</p>
      </div>
    `,
  },

  PAYMENT_FAILED: {
    subject: 'Payment Failed - #{bookingId}',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">❌ Payment Failed</h2>
        <p>Dear ${data.customerName},</p>
        <p>Unfortunately, your payment could not be processed.</p>
        <div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p><strong>Amount:</strong> ${data.amount} VND</p>
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        <p>Please try again or use a different payment method.</p>
      </div>
    `,
  },
};

export const smsTemplates = {
  BOOKING_CREATED: (data: any) =>
    `Booking confirmed! ID: ${data.bookingId}. Pickup: ${data.pickupAddress}. Fare: ${data.estimatedFare} VND. Track your ride in the app.`,

  RIDE_ACCEPTED: (data: any) =>
    `Driver assigned! ${data.driverName} is on the way. Vehicle: ${data.licensePlate}. ETA: ${data.eta} mins.`,

  RIDE_STARTED: (data: any) =>
    `Your ride has started! Destination: ${data.destination}. Enjoy your journey!`,

  RIDE_COMPLETED: (data: any) =>
    `Ride completed! Distance: ${data.distance}km, Fare: ${data.finalFare} VND. Please rate your driver.`,

  PAYMENT_SUCCESSFUL: (data: any) =>
    `Payment successful! Amount: ${data.amount} VND. Transaction ID: ${data.transactionId}. Thank you!`,

  PAYMENT_FAILED: (data: any) =>
    `Payment failed for booking ${data.bookingId}. Reason: ${data.reason}. Please retry or contact support.`,

  OTP_VERIFICATION: (data: any) =>
    `Your OTP code is: ${data.otp}. Valid for 5 minutes. Do not share this code with anyone.`,
};
