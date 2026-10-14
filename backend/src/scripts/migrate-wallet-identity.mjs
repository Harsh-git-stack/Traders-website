import "dotenv/config";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
const tenantId = process.env.TENANT_ID || "trade4worldfx";
const uri = process.env.MONGO_URI;

if (!uri) throw new Error("MONGO_URI is required.");

await mongoose.connect(uri);
const db = mongoose.connection.db;
const portalUsers = await db.collection("portal_users")
    .find({ tenantId, tradingUserId: { $type: "string", $ne: "" } })
    .toArray();

let requestUpdates = 0;
let walletMoves = 0;
let walletMerges = 0;
let transferUpdates = 0;

for (const portalUser of portalUsers) {
    const portalUserId = String(portalUser._id);
    const tradingUserId = String(portalUser.tradingUserId);

    const requestFilter = {
        tenantId,
        userId: tradingUserId,
        $or: [{ portalUserId: { $exists: false } }, { portalUserId: null }, { portalUserId: "" }]
    };
    if (apply) {
        const requests = await db.collection("client_requests").updateMany(
            requestFilter,
            { $set: { portalUserId } }
        );
        requestUpdates += requests.modifiedCount;
    } else {
        requestUpdates += await db.collection("client_requests").countDocuments(requestFilter);
    }

    const legacyWallet = await db.collection("wallet_balances").findOne({ tenantId, userId: tradingUserId });
    const portalWallet = await db.collection("wallet_balances").findOne({ tenantId, userId: portalUserId });

    if (legacyWallet && !portalWallet) {
        if (apply) {
            await db.collection("wallet_balances").updateOne(
                { _id: legacyWallet._id, tenantId, userId: tradingUserId },
                { $set: { userId: portalUserId, updatedAt: new Date() } }
            );
        }
        walletMoves += 1;
    } else if (legacyWallet && portalWallet) {
        if (apply) {
            await db.collection("wallet_balances").updateOne(
                { _id: portalWallet._id, tenantId, userId: portalUserId },
                { $inc: { balance: Number(legacyWallet.balance || 0) }, $set: { updatedAt: new Date() } }
            );
            await db.collection("wallet_balances").deleteOne({ _id: legacyWallet._id, tenantId, userId: tradingUserId });
        }
        walletMerges += 1;
    }

    const transferFilter = { tenantId, userId: tradingUserId };
    if (apply) {
        const transfers = await db.collection("transfers").updateMany(
            transferFilter,
            { $set: { userId: portalUserId, updatedAt: new Date() } }
        );
        transferUpdates += transfers.modifiedCount;
    } else {
        transferUpdates += await db.collection("transfers").countDocuments(transferFilter);
    }
}

console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", tenantId, portalUsers: portalUsers.length, requestUpdates, walletMoves, walletMerges, transferUpdates }, null, 2));
if (!apply) console.log("Dry run only. Review the totals, then run: npm run migrate:wallet-identity -- --apply");
await mongoose.disconnect();
