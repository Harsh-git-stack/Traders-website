import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";

async function startServer() {
    if (env.skipMongo) {
        console.warn("MongoDB connection skipped. Mongo-backed routes will not work in this mode.");
    } else {
        await connectDb();
    }

    app.listen(env.port, () => {
        console.log(`Portal backend running on http://localhost:${env.port}`);
    });
}

startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
