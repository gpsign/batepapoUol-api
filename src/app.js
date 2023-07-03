import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {

});

app.listen(5000);