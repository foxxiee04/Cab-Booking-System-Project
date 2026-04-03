import amqplib from 'amqplib';
import { config } from '../config';
import { notificationService } from '../services/notification.service';
import { NotificationPriority } from '../models/notification.model';

let connection: any = null;
let channel: any = null;
const EXCHANGE_NAME = 'domain-events';
const NOTIFICATION_ROUTING_KEYS = [
  'booking.created',
  'ride.assigned',
  'ride.accepted',
  'ride.completed',
  'payment.completed',
  'payment.failed',
  'payment.success',
];

export function isRabbitMQConnected(): boolean {
  return Boolean(connection && channel);
}

export async function connectRabbitMQ() {
  try {
    connection = await amqplib.connect(config.rabbitmq.url);
    if (!connection) throw new Error('Failed to connect to RabbitMQ');
    
    channel = await connection.createChannel();
    if (!channel) throw new Error('Failed to create channel');

    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await channel.assertQueue(config.rabbitmq.queue, { durable: true });

    for (const routingKey of NOTIFICATION_ROUTING_KEYS) {
      await channel.bindQueue(config.rabbitmq.queue, EXCHANGE_NAME, routingKey);
    }
    
    console.log(`✅ RabbitMQ connected, listening on queue: ${config.rabbitmq.queue}`);
    
    // Start consuming messages
    await channel.consume(
      config.rabbitmq.queue,
      async (msg: any) => {
        if (msg && channel) {
          try {
            const event = JSON.parse(msg.content.toString());
            const eventType = event.eventType || event.type || msg.fields.routingKey;
            console.log('📩 Received event:', eventType);
            
            await handleEvent(eventType, event.payload || event.data || {});
            
            channel.ack(msg);
          } catch (error) {
            console.error('❌ Error processing message:', error);
            channel.nack(msg, false, false); // Don't requeue on error
          }
        }
      },
      { noAck: false }
    );
  } catch (error) {
    console.error('❌ RabbitMQ connection failed:', error);
    // Retry connection after 5 seconds
    setTimeout(connectRabbitMQ, 5000);
  }
}

function getReadableId(value: unknown, prefix: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return prefix;
}

async function sendRuntimeInAppNotification(data: {
  userId?: string;
  subject: string;
  message: string;
  metadata?: Record<string, any>;
  priority?: NotificationPriority;
}) {
  if (!data.userId) {
    console.warn(`⚠️ Skipping notification without userId for ${data.metadata?.event || 'unknown event'}`);
    return;
  }

  await notificationService.sendInAppNotification({
    userId: data.userId,
    subject: data.subject,
    message: data.message,
    metadata: data.metadata,
    priority: data.priority,
  });
}

async function handleEvent(eventType: string, payload: any) {
  switch (eventType) {
    case 'BOOKING_CREATED':
      await notificationService.sendBookingCreatedNotification({
        userId: payload.customerId,
        email: payload.customerEmail,
        phone: payload.customerPhone,
        bookingId: payload.bookingId,
        customerName: payload.customerName,
        vehicleType: payload.vehicleType,
        pickupAddress: payload.pickupAddress,
        dropoffAddress: payload.dropoffAddress,
        estimatedFare: payload.estimatedFare,
      });
      break;

    case 'booking.created':
      await sendRuntimeInAppNotification({
        userId: payload.customerId,
        subject: 'Booking confirmed',
        message: `Booking ${getReadableId(payload.bookingId, 'unknown')} has been confirmed.`,
        metadata: {
          event: eventType,
          bookingId: payload.bookingId,
          vehicleType: payload.vehicleType,
          estimatedFare: payload.estimatedFare,
        },
        priority: NotificationPriority.HIGH,
      });
      break;

    case 'RIDE_ACCEPTED':
      await notificationService.sendRideAcceptedNotification({
        userId: payload.customerId,
        email: payload.customerEmail,
        phone: payload.customerPhone,
        bookingId: payload.bookingId,
        customerName: payload.customerName,
        driverName: payload.driverName,
        vehicleMake: payload.vehicleMake,
        vehicleModel: payload.vehicleModel,
        licensePlate: payload.licensePlate,
        eta: payload.eta || 5,
      });
      break;

    case 'ride.assigned':
    case 'ride.accepted':
      await sendRuntimeInAppNotification({
        userId: payload.customerId,
        subject: 'Driver found',
        message: `A driver has been assigned for ride ${getReadableId(payload.rideId, 'unknown')}.`,
        metadata: {
          event: eventType,
          rideId: payload.rideId,
          driverId: payload.driverId,
        },
        priority: NotificationPriority.URGENT,
      });
      break;

    case 'RIDE_COMPLETED':
      await notificationService.sendRideCompletedNotification({
        userId: payload.customerId,
        email: payload.customerEmail,
        phone: payload.customerPhone,
        bookingId: payload.bookingId,
        customerName: payload.customerName,
        distance: payload.distance,
        duration: payload.duration,
        finalFare: payload.finalFare,
      });
      break;

    case 'ride.completed':
      await sendRuntimeInAppNotification({
        userId: payload.customerId,
        subject: 'Ride completed',
        message: `Ride ${getReadableId(payload.rideId, 'unknown')} completed successfully.`,
        metadata: {
          event: eventType,
          rideId: payload.rideId,
          fare: payload.fare,
          distance: payload.distance,
          duration: payload.duration,
        },
        priority: NotificationPriority.HIGH,
      });
      break;

    case 'PAYMENT_SUCCESS':
      await notificationService.sendPaymentNotification(
        {
          userId: payload.customerId,
          email: payload.customerEmail,
          phone: payload.customerPhone,
          bookingId: payload.bookingId,
          customerName: payload.customerName,
          amount: payload.amount,
          paymentMethod: payload.paymentMethod,
          transactionId: payload.transactionId,
          paymentDate: new Date().toISOString(),
        },
        true
      );
      break;

    case 'payment.completed':
    case 'payment.success':
      await sendRuntimeInAppNotification({
        userId: payload.customerId,
        subject: 'Payment completed',
        message: `Payment for ride ${getReadableId(payload.rideId || payload.orderId, 'unknown')} was completed successfully.`,
        metadata: {
          event: eventType,
          rideId: payload.rideId,
          orderId: payload.orderId,
          amount: payload.amount,
          transactionId: payload.transactionId,
        },
        priority: NotificationPriority.HIGH,
      });
      break;

    case 'PAYMENT_FAILED':
      await notificationService.sendPaymentNotification(
        {
          userId: payload.customerId,
          email: payload.customerEmail,
          phone: payload.customerPhone,
          bookingId: payload.bookingId,
          customerName: payload.customerName,
          amount: payload.amount,
          paymentMethod: payload.paymentMethod || 'Unknown',
          transactionId: payload.transactionId || 'N/A',
          paymentDate: new Date().toISOString(),
        },
        false
      );
      break;

    case 'payment.failed':
      await sendRuntimeInAppNotification({
        userId: payload.customerId,
        subject: 'Payment failed',
        message: `Payment for ride ${getReadableId(payload.rideId, 'unknown')} failed. Please try again.`,
        metadata: {
          event: eventType,
          rideId: payload.rideId,
          amount: payload.amount,
          transactionId: payload.transactionId,
        },
        priority: NotificationPriority.URGENT,
      });
      break;

    default:
      console.log('⚠️ Unknown event type:', eventType);
  }
}

export async function closeRabbitMQ() {
  if (channel) await channel.close();
  if (connection) await connection.close();
  console.log('RabbitMQ connection closed');
}
