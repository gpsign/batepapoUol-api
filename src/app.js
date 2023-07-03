import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

dotenv.config();


const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
    await mongoClient.connect();
} catch (err) {
    console.log(err.message);
}

const db = mongoClient.db();

const app = express();
app.use(express.json());
app.use(cors());

const userSchema = joi.object({
    name: joi.string().required(),
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
});

app.post("/participants", async (req, res) => {
    try {
        const validation = userSchema.validate(req.body, { abortEarly: false });

        if (validation.error) {
            const errors = validation.error.details.map((detail) => detail.message);
            return res.status(422).send(errors);
        }

        let exist = await db.collection("participants").findOne({ name: req.body.name });

        if (!exist) {
            await db.collection("participants").insertOne({ name: req.body.name, lastStatus: Date.now() });
            await db.collection("messages").insertOne({
                from: req.body.name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            });
            res.send(201);
        }
        else res.send(209);
    }
    catch (error) {
        console.log(error);
    }

})

app.post("/messages", async (req, res) => {

    try {
        const validation = messageSchema.validate(req.body, { abortEarly: false });

        let exist = await db.collection("participants").findOne({ name: req.header.User })
        if (!exist) res.send(422);

        if (validation.error) {
            const errors = validation.error.details.map((detail) => detail.message);
            return res.status(422).send(errors);
        }
        db.collection("messages").insertOne({
            to: req.body.to,
            text: req.body.text,
            type: req.body.type,
            time: dayjs().format('HH:mm:ss'),
        })
        res.send(201);
    } catch (error) {
        console.log(error);
    }

})

app.get("/participants", async (req, res) => {
    res.send(await db.collection("participants").find().toArray());
})

app.get("/messages", async (req, res) => {
    let limit = parseInt(req.query.limit);
    if (limit < 1) res.send(422);

    let messages = await db.collection("messages").find({
        $or: [
            { to: req.header.User, type: "private_message" },
            { from: req.header.User, type: "private_message" },
            { to: "Todos", type: "message" }
        ]
    }).toArray();

    if (limit = undefined) res.send(messages);
    else res.send(messages.splice(0, limit - 1));
})

app.listen(5000);