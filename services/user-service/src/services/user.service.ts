import { prisma } from '../config/db';

export async function getUserProfile(userId: string) {
  return prisma.userProfile.findUnique({ where: { userId } });
}

export async function createUserProfile(data: {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  email?: string;
}) {
  const { userId, firstName, lastName, phone, avatar } = data;

  return prisma.userProfile.create({
    data: {
      userId,
      firstName,
      lastName,
      phone,
      avatar,
    },
  });
}
