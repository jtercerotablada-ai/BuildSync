import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import prisma from "./prisma";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  return user;
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id;
}
