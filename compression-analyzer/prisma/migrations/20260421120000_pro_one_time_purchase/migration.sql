-- CreateTable
CREATE TABLE "ProOneTimePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paypalOrderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountCents" INTEGER,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProOneTimePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProOneTimePurchase_userId_key" ON "ProOneTimePurchase"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProOneTimePurchase_paypalOrderId_key" ON "ProOneTimePurchase"("paypalOrderId");

-- CreateIndex
CREATE INDEX "ProOneTimePurchase_userId_idx" ON "ProOneTimePurchase"("userId");

-- AddForeignKey
ALTER TABLE "ProOneTimePurchase" ADD CONSTRAINT "ProOneTimePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
