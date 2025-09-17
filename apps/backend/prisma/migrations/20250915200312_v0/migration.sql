-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."balances" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "decimals" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "asset" TEXT,
    "direction" TEXT,
    "amount" BIGINT,
    "leverage" BIGINT,
    "tradeId" TEXT,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trades" (
    "id" SERIAL NOT NULL,
    "tradeId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "margin" BIGINT NOT NULL,
    "leverage" BIGINT NOT NULL,
    "entryPrice" BIGINT NOT NULL,
    "entryPriceDecimals" INTEGER NOT NULL,
    "liquidationPrice" BIGINT,
    "liquidationPriceDecimals" INTEGER,
    "exitPrice" BIGINT,
    "exitPriceDecimals" INTEGER,
    "pnl" BIGINT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "balances_userId_asset_key" ON "public"."balances"("userId", "asset");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderId_key" ON "public"."orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "trades_tradeId_key" ON "public"."trades"("tradeId");

-- AddForeignKey
ALTER TABLE "public"."balances" ADD CONSTRAINT "balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trades" ADD CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
