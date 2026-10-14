import mongoose from "mongoose";
import { env } from "../config/env.js";

const tenantId = String(process.env.BACKFILL_TENANT_ID || "nexford").trim().toLowerCase();
const collections = [
    "portal_users",
    "portal_trading_accounts",
    "client_requests",
    "transfers",
    "wallet_balances",
    "reward_balances"
];

async function ensureIndex(collection, key, options) {
    const indexes = await collection.indexes();
    const matching = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify(key));
    if (matching) {
        if (Boolean(matching.unique) !== Boolean(options.unique)) {
            throw new Error(`Existing index ${matching.name} has incompatible uniqueness for ${JSON.stringify(key)}`);
        }
        console.log(`${collection.collectionName}: using existing index ${matching.name}`);
        return;
    }
    await collection.createIndex(key, options);
}

async function dropLegacyGlobalUniqueIndex(collection, key) {
    const indexes = await collection.indexes();
    const legacyIndex = indexes.find((index) =>
        JSON.stringify(index.key) === JSON.stringify(key) && Boolean(index.unique)
    );

    if (!legacyIndex) return;

    await collection.dropIndex(legacyIndex.name);
    console.log(`${collection.collectionName}: dropped legacy global unique index ${legacyIndex.name}`);
}

if (!tenantId) throw new Error("BACKFILL_TENANT_ID is required");

await mongoose.connect(env.mongoUri);

try {
    for (const name of collections) {
        const result = await mongoose.connection.collection(name).updateMany(
            { tenantId: { $exists: false } },
            { $set: { tenantId } }
        );
        console.log(`${name}: tagged ${result.modifiedCount} record(s) as ${tenantId}`);
    }

    // These indexes came from the single-brand portal. They would incorrectly
    // prevent the same email/referral code from existing in separate tenants.
    await dropLegacyGlobalUniqueIndex(mongoose.connection.collection("portal_users"), { email: 1 });
    await dropLegacyGlobalUniqueIndex(mongoose.connection.collection("portal_users"), { referralCode: 1 });

    await ensureIndex(mongoose.connection.collection("portal_users"),
        { tenantId: 1, email: 1 }, { unique: true, name: "tenant_email_unique" }
    );
    await ensureIndex(mongoose.connection.collection("portal_users"),
        { tenantId: 1, referralCode: 1 }, {
            unique: true,
            name: "tenant_referral_code_unique",
            partialFilterExpression: { referralCode: { $type: "string" } }
        }
    );
    await ensureIndex(mongoose.connection.collection("portal_trading_accounts"),
        { tenantId: 1, accountNumber: 1 }, { unique: true }
    );
    await ensureIndex(mongoose.connection.collection("portal_trading_accounts"),
        { tenantId: 1, tradingUserId: 1 }, { unique: true }
    );
    console.log("Portal tenant backfill completed.");
} finally {
    await mongoose.disconnect();
}
