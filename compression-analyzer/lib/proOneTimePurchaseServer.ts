import { prisma } from "@/lib/prisma";

const STATUS = "COMPLETED" as const;

/**
 * Idempotent: one row per user. Call after a successful PayPal capture.
 */
export async function upsertProOneTimePurchase(args: {
  userId: string;
  paypalOrderId: string;
  amountCents: number;
  currency: string;
}): Promise<void> {
  await prisma.proOneTimePurchase.upsert({
    where: { userId: args.userId },
    create: {
      userId: args.userId,
      paypalOrderId: args.paypalOrderId,
      status: STATUS,
      amountCents: args.amountCents,
      currency: args.currency,
    },
    update: {
      paypalOrderId: args.paypalOrderId,
      status: STATUS,
      amountCents: args.amountCents,
      currency: args.currency,
    },
  });
}
