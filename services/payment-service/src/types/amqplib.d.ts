import type { Channel, Connection } from 'amqplib';

declare module 'amqplib' {
  export function connect(url: any, socketOptions?: any): Promise<Connection>;

  interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }
}
