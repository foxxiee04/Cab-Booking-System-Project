import amqplib from 'amqplib';
import { config } from '../config';
import { notificationService } from '../services/notification.service';

let connection: any = null;
let channel: any = null;

export async function connectRabbitMQ() {
  try {
    connection = await amqplib.connect(config.rabbitmq.url);
    if (!connection) throw new Error('Failed to connect to RabbitMQ');
    
    channel = await connection.createChannel();
    if (!channel) throw new Error('Failed to create channel');
    
    await channel.assertQueue(config.rabbitmq.queue, { durable: true });
    
    console.log(`✅ RabbitMQ connected, listening on queue: ${config.rabbitmq.queue}`);
    
    // Start consuming messages
    await channel.consume(
      config.rabbitmq.queue,
      async (msg: any) => {
        if (msg && channel) {
          try {
            const event = JSON.parse(msg.content.toString());
            console.log('📩 Received event:', event.type);
            
            await handleEvent(event);
            
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

async function handleEvent(event: any) {
  switch (event.type) {
    case 'BOOKING_CREATED':
      await notificationService.sendBookingCreatedNotification({
        userId: event.data.customerId,
        email: event.data.customerEmail,
        phone: event.data.customerPhone,
        bookingId: event.data.bookingId,
        customerName: event.data.customerName,
        vehicleType: event.data.vehicleType,
        pickupAddress: event.data.pickupAddress,
        dropoffAddress: event.data.dropoffAddress,
        estimatedFare: event.data.estimatedFare,
      });
      break;

    case 'RIDE_ACCEPTED':
      await notificationService.sendRideAcceptedNotification({
        userId: event.data.customerId,
        email: event.data.customerEmail,
        phone: event.data.customerPhone,
        bookingId: event.data.bookingId,
        customerName: event.data.customerName,
        driverName: event.data.driverName,
        vehicleMake: event.data.vehicleMake,
        vehicleModel: event.data.vehicleModel,
        licensePlate: event.data.licensePlate,
        eta: event.data.eta || 5,
      });
      break;

    case 'RIDE_COMPLETED':
      await notificationService.sendRideCompletedNotification({
        userId: event.data.customerId,
        email: event.data.customerEmail,
        phone: event.data.customerPhone,
        bookingId: event.data.bookingId,
        customerName: event.data.customerName,
        distance: event.data.distance,
        duration: event.data.duration,
        finalFare: event.data.finalFare,
      });
      break;

    case 'PAYMENT_SUCCESS':
      await notificationService.sendPaymentNotification(
        {
          userId: event.data.customerId,
          email: event.data.customerEmail,
          phone: event.data.customerPhone,
          bookingId: event.data.bookingId,
          customerName: event.data.customerName,
          amount: event.data.amount,
          paymentMethod: event.data.paymentMethod,
          transactionId: event.data.transactionId,
          paymentDate: new Date().toISOString(),
        },
        true
      );
      break;

    case 'PAYMENT_FAILED':
      await notificationService.sendPaymentNotification(
        {
          userId: event.data.customerId,
          email: event.data.customerEmail,
          phone: event.data.customerPhone,
          bookingId: event.data.bookingId,
          customerName: event.data.customerName,
          amount: event.data.amount,
          paymentMethod: event.data.paymentMethod || 'Unknown',
          transactionId: event.data.transactionId || 'N/A',
          paymentDate: new Date().toISOString(),
        },
        false
      );
      break;

    default:
      console.log('⚠️ Unknown event type:', event.type);
  }
}

export async function closeRabbitMQ() {
  if (channel) await channel.close();
  if (connection) await connection.close();
  console.log('RabbitMQ connection closed');
}
