import { Request, Response } from 'express';

// Mock notificationService
const mockGetUserNotifications = jest.fn();
const mockCreateNotification = jest.fn();
const mockSendNotification = jest.fn();
const mockRetryFailedNotifications = jest.fn();

jest.mock('../services/notification.service', () => ({
  notificationService: {
    getUserNotifications: (...args: any[]) => mockGetUserNotifications(...args),
    createNotification: (...args: any[]) => mockCreateNotification(...args),
    sendNotification: (...args: any[]) => mockSendNotification(...args),
    retryFailedNotifications: (...args: any[]) => mockRetryFailedNotifications(...args),
  },
}));

// Mock notification model for getStatistics
const mockCountDocuments = jest.fn();
jest.mock('../models/notification.model', () => {
  const actual = jest.requireActual('../models/notification.model');
  return {
    ...actual,
    NotificationModel: {
      countDocuments: (...args: any[]) => mockCountDocuments(...args),
    },
  };
});

import { notificationController } from '../controllers/notification.controller';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('NotificationController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    it('should return 401 if x-user-id header is missing', async () => {
      const req = mockReq({ headers: {} });
      const res = mockRes();

      await notificationController.getUserNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return notifications for valid user', async () => {
      const notifications = [
        { _id: 'n1', message: 'msg1' },
        { _id: 'n2', message: 'msg2' },
      ];
      mockGetUserNotifications.mockResolvedValue(notifications);

      const req = mockReq({
        headers: { 'x-user-id': 'user-1' },
        query: { limit: '10' },
      });
      const res = mockRes();

      await notificationController.getUserNotifications(req, res);

      expect(mockGetUserNotifications).toHaveBeenCalledWith('user-1', 10);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        notifications,
      });
    });

    it('should use default limit of 50', async () => {
      mockGetUserNotifications.mockResolvedValue([]);

      const req = mockReq({
        headers: { 'x-user-id': 'user-1' },
        query: {},
      });
      const res = mockRes();

      await notificationController.getUserNotifications(req, res);

      expect(mockGetUserNotifications).toHaveBeenCalledWith('user-1', 50);
    });
  });

  describe('sendNotification', () => {
    it('should return 400 if required fields are missing', async () => {
      const req = mockReq({
        body: { userId: 'user-1', type: 'EMAIL' }, // missing recipient and message
      });
      const res = mockRes();

      await notificationController.sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    it('should create and send notification successfully', async () => {
      const notification = { _id: 'notif-1', status: 'PENDING' };
      mockCreateNotification.mockResolvedValue(notification);
      mockSendNotification.mockResolvedValue(true);

      const req = mockReq({
        body: {
          userId: 'user-1',
          type: 'EMAIL',
          recipient: 'test@example.com',
          message: 'Hello',
          subject: 'Test',
        },
      });
      const res = mockRes();

      await notificationController.sendNotification(req, res);

      expect(mockCreateNotification).toHaveBeenCalled();
      expect(mockSendNotification).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        notification,
        sent: true,
      });
    });

    it('should return 500 on error', async () => {
      mockCreateNotification.mockRejectedValue(new Error('DB error'));

      const req = mockReq({
        body: {
          userId: 'user-1',
          type: 'EMAIL',
          recipient: 'x@x.com',
          message: 'msg',
        },
      });
      const res = mockRes();

      await notificationController.sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('retryFailedNotifications', () => {
    it('should return retry results', async () => {
      mockRetryFailedNotifications.mockResolvedValue({ retried: 5, success: 3 });

      const req = mockReq();
      const res = mockRes();

      await notificationController.retryFailedNotifications(req, res);

      expect(res.json).toHaveBeenCalledWith({ retried: 5, success: 3 });
    });

    it('should return 500 on error', async () => {
      mockRetryFailedNotifications.mockRejectedValue(new Error('fail'));

      const req = mockReq();
      const res = mockRes();

      await notificationController.retryFailedNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      mockCountDocuments
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10)  // pending
        .mockResolvedValueOnce(80)  // sent
        .mockResolvedValueOnce(10); // failed

      const req = mockReq();
      const res = mockRes();

      await notificationController.getStatistics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        statistics: {
          total: 100,
          pending: 10,
          sent: 80,
          failed: 10,
          successRate: '80.00%',
        },
      });
    });

    it('should return N/A for empty database', async () => {
      mockCountDocuments
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const req = mockReq();
      const res = mockRes();

      await notificationController.getStatistics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        statistics: {
          total: 0,
          pending: 0,
          sent: 0,
          failed: 0,
          successRate: 'N/A',
        },
      });
    });
  });
});
