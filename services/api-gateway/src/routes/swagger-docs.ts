/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: customer@gmail.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Customer@123
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, DRIVER]
 *                 example: CUSTOMER
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and get JWT token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: customer1@gmail.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Customer@123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                         refreshToken:
 *                           type: string
 *                           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         userId:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         address:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/drivers:
 *   get:
 *     summary: Get all drivers (admin/customer view)
 *     tags: [Drivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ONLINE, OFFLINE, BUSY]
 *         description: Filter by availability status
 *     responses:
 *       200:
 *         description: List of drivers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     drivers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Driver'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 */

/**
 * @swagger
 * /api/drivers/profile:
 *   get:
 *     summary: Get driver's own profile
 *     tags: [Drivers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Driver profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     driver:
 *                       $ref: '#/components/schemas/Driver'
 */

/**
 * @swagger
 * /api/drivers/availability:
 *   put:
 *     summary: Update driver availability status
 *     tags: [Drivers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ONLINE, OFFLINE, BUSY]
 *                 example: ONLINE
 *     responses:
 *       200:
 *         description: Availability updated successfully
 */

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickupLocation
 *               - dropoffLocation
 *               - vehicleType
 *               - paymentMethod
 *             properties:
 *               pickupLocation:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                     example: Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội
 *                   geoPoint:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                         example: 21.0055
 *                       lng:
 *                         type: number
 *                         example: 105.8428
 *               dropoffLocation:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                     example: Số 100 Nguyễn Văn Cừ, Long Biên, Hà Nội
 *                   geoPoint:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                         example: 21.0355
 *                       lng:
 *                         type: number
 *                         example: 105.8588
 *               vehicleType:
 *                 type: string
 *                 enum: [ECONOMY, COMFORT, PREMIUM]
 *                 example: ECONOMY
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, CARD, WALLET]
 *                 example: CASH
 *               notes:
 *                 type: string
 *                 example: Please wait near entrance
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     booking:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         status:
 *                           type: string
 *                           example: PENDING
 *                         estimatedFare:
 *                           type: number
 */

/**
 * @swagger
 * /api/rides:
 *   get:
 *     summary: Get rides (customer: own rides, driver: assigned rides)
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPTED, PICKING_UP, IN_PROGRESS, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: List of rides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     rides:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ride'
 */

/**
 * @swagger
 * /api/rides/{rideId}/accept:
 *   put:
 *     summary: Driver accepts a ride request
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ride accepted successfully
 */

/**
 * @swagger
 * /api/rides/{rideId}/start:
 *   put:
 *     summary: Driver starts the ride
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ride started successfully
 */

/**
 * @swagger
 * /api/rides/{rideId}/complete:
 *   put:
 *     summary: Driver completes the ride
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actualFare:
 *                 type: number
 *                 example: 206800
 *               actualDistance:
 *                 type: number
 *                 example: 6.2
 *               actualDuration:
 *                 type: integer
 *                 example: 517
 *     responses:
 *       200:
 *         description: Ride completed successfully
 */

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     payments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Payment'
 */

/**
 * @swagger
 * /api/payments/methods:
 *   get:
 *     summary: Get available payment methods
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment methods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     methods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: CASH
 *                           name:
 *                             type: string
 *                             example: Tiền mặt
 *                           icon:
 *                             type: string
 *                             example: cash
 *                           enabled:
 *                             type: boolean
 */

/**
 * @swagger
 * /api/pricing/estimate:
 *   post:
 *     summary: Get fare estimate
 *     tags: [Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickupLat
 *               - pickupLng
 *               - dropoffLat
 *               - dropoffLng
 *               - vehicleType
 *             properties:
 *               pickupLat:
 *                 type: number
 *                 example: 21.0055
 *               pickupLng:
 *                 type: number
 *                 example: 105.8428
 *               dropoffLat:
 *                 type: number
 *                 example: 21.0355
 *               dropoffLng:
 *                 type: number
 *                 example: 105.8588
 *               vehicleType:
 *                 type: string
 *                 enum: [ECONOMY, COMFORT, PREMIUM]
 *                 example: ECONOMY
 *     responses:
 *       200:
 *         description: Fare estimate calculated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     fare:
 *                       type: number
 *                       example: 206800
 *                     distance:
 *                       type: number
 *                       example: 6.2
 *                     duration:
 *                       type: integer
 *                       example: 517
 *                     surgeMultiplier:
 *                       type: number
 *                       example: 1.0
 */

/**
 * @swagger
 * /api/admin/statistics:
 *   get:
 *     summary: Get system statistics (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         rides:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             today:
 *                               type: integer
 *                             pending:
 *                               type: integer
 *                             active:
 *                               type: integer
 *                             completed:
 *                               type: integer
 *                             cancelled:
 *                               type: integer
 *                         drivers:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             online:
 *                               type: integer
 *                             offline:
 *                               type: integer
 *                             busy:
 *                               type: integer
 *                         revenue:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: number
 *                             today:
 *                               type: number
 *                             week:
 *                               type: number
 *                             month:
 *                               type: number
 *       403:
 *         description: Forbidden - admin only
 */

// Export empty object to make this a valid module
export {};
