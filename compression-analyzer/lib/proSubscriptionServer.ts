import { prisma } from "@/lib/prisma";

/** PayPal states that should grant Pro access (renewal failures move to other states via webhooks). */
const PRO_ACCESS_STATUSES = ["ACTIVE", "APPROVED"] as const;

const ONETIME_OK = "COMPLETED" as const;

export async function userHasActiveProSubscription(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const row = await prisma.payPalSubscription.findFirst({
    where: {
      userId,
      status: { in: [...PRO_ACCESS_STATUSES] },
    },
  });
  return Boolean(row);
}

/** Pro: active subscription (monthly) or one-time purchase completed. */
export async function userHasProEntitlement(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  if (await userHasActiveProSubscription(userId)) return true;
  const one = await prisma.proOneTimePurchase.findUnique({
    where: { userId },
  });
  return Boolean(one && one.status === ONETIME_OK);
}
