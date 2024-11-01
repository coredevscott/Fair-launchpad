import express from "express";
import cors from "cors";
import http from "http";
import 'dotenv/config.js';
import userRoutes from './routes/user'
import coinRoutes from './routes/coin'
import messageRoutes from './routes/feedback'
import coinTradeRoutes from './routes/coinTradeRoutes'
import chartRoutes from './routes/chart'
import { init } from './db/dbConncetion';
import { io, socketio } from "./sockets";
import rateLimit from 'express-rate-limit';


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
});

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
if (!process.env.PORT) {
    console.warn("PORT environment variable is not set. Using default port, 5000.");
}

const corsOptions = {
    origin: "https://fairlaunch.kommunitas.net",
    credentials: false,
    sameSite: "none",
};

app.use(limiter);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

init()

app.use('/user/', userRoutes);
app.use('/coin/', coinRoutes);
app.use('/feedback/', messageRoutes);
app.use('/cointrade/', coinTradeRoutes)
app.use('/chart/', chartRoutes)

const server = http.createServer(app);
socketio(server);

server.listen(port, async () => {
    console.log(`server is listening on ${port}`);

    return;
});
