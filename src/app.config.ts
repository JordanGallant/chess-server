import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import cors from "cors";

/**
 * Import your Room files
 */
import { ChessRoom } from "./rooms/MyRoom";

export default config({

    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('chess_room', ChessRoom);
    },

    initializeExpress: (app) => {
        /**
         * ✅ Allow all CORS origins (for development)
         * ⚠️ WARNING: Don't use this in production without restrictions!
         */
        app.use(cors({
            origin: "*",
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type"],
        }));

        /**
         * Custom Express route
         */
        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        /**
         * Playground (dev only)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }

        /**
         * Monitor panel (should be password protected in production)
         */
        app.use("/monitor", monitor());
    },

    beforeListen: () => {
        /**
         * Before gameServer.listen() is called.
         */
    }
});
