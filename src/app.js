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

setInterval(async () => {
    let inativos = await db.collection("participants").find({ lastStatus: { $lt: Date.now() - 10000 } }).toArray();

    inativos.map((user) => {
        db.collection("messages").insertOne({
            from: user.name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        });
    });

    db.collection("participants").deleteMany({ lastStatus: { $lt: Date.now() - 10000 } });

}, 15000);

const userSchema = joi.object({
    name: joi.string().required(),
});

const userStatusSchema = joi.object({
    user: joi.string().required(),
}).unknown();

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
        else res.send(409);
    }
    catch (error) {
        console.log(error);
    }

})

app.post("/messages", async (req, res) => {

    console.log(req.headers);
    try {
        const validation = messageSchema.validate(req.body, { abortEarly: false });
        let exist = await db.collection("participants").findOne({ name: req.headers.user })

        if (validation.error) {
            const errors = validation.error.details.map((detail) => detail.message);
            return res.status(422).send(errors);
        }
        else if (!exist) {
            console.log(exist);
            res.send(422);
        }

        else {

            db.collection("messages").insertOne({
                to: req.body.to,
                from: req.headers.user,
                text: req.body.text,
                type: req.body.type,
                time: dayjs().format('HH:mm:ss'),
            })
            res.send(201);
        }

    } catch (error) {
        console.log(error);
    }

})

app.post("/status", async (req, res) => {
    const validation = userStatusSchema.validate(req.headers, { abortEarly: false });

    try {
        if (validation.error) {
            const errors = validation.error.details.map((detail) => detail.message);
            return res.status(404).send(errors);
        }
        let exist = await db.collection("participants").findOne({ name: req.headers.user });
        if (!exist) res.send(404);
        else {
            await db
                .collection("participants")
                .updateOne({ name: req.headers.user }, { $set: { lastStatus: Date.now() } });
            res.send(200);
        }
    }
    catch (error) { console.log(error); }
})


app.get("/participants", async (req, res) => {
    res.send(await db.collection("participants").find().toArray());
})

app.get("/messages", async (req, res) => {

    let messages = await db.collection("messages").find({
        $or: [
            { to: req.headers.user, type: "private_message" },
            { from: req.headers.user, type: "private_message" },
            { to: "Todos"}
        ]
    }).toArray();

    let limit = req.query.limit;
    console.log(limit);
    if (limit == undefined) return res.send(messages);
    limit = Number(limit);
    if (limit < 1 || isNaN(limit)) res.send(422);
    else res.send(messages.splice(0, limit));
})

app.listen(5000);