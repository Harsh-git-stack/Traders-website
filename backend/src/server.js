import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";

async function startServer() {
    await connectDb();

    app.listen(env.port, () => {
        console.log(`Portal backend running on http://localhost:${env.port}`);
    });
}

startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
