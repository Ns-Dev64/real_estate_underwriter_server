import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { parseT12Controller,parseRentRollController,getPropertyDetails, getDealOutput, saveDealToDB, fetchRecentDeals, deleteDeal } from "./controllers/controller";
import { register,login } from "./controllers/authController";
import connectDB from "./db/init";
import cors from "cors"
import { upload } from "./middleware/multer";
import { authMiddleware } from "./middleware/authMiddleware";
const app = express();

app.use(express.json());
app.use(cors())
const port = process.env.PORT || "5001";

const BASE_API_URL = "/api/v1";

app.post(`${BASE_API_URL}/register`,register);
app.post(`${BASE_API_URL}/login`,login);
app.get(`${BASE_API_URL}/property`,authMiddleware,getPropertyDetails);
app.post(`${BASE_API_URL}/t12`,authMiddleware,upload.single("file"),parseT12Controller);
app.post(`${BASE_API_URL}/rent`,authMiddleware,upload.single("file"),parseRentRollController);
app.post(`${BASE_API_URL}/deal`,authMiddleware,getDealOutput);
app.post(`${BASE_API_URL}/deals`,authMiddleware,saveDealToDB);
app.get(`${BASE_API_URL}/deals`,authMiddleware,fetchRecentDeals);
app.delete(`${BASE_API_URL}/deals/:dealId`,authMiddleware,deleteDeal);


connectDB().catch((err)=>{
    console.log("error connecting to db",err)
})

app.listen(port, () => console.log(`server running on ${port}`));


