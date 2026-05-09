import express from "express";
import cors from "cors";

const app = express();

// middleware
app.use(cors());
app.use(express.json());

let queue = [];

app.get("/", (req, res) => {
    res.send("matchmaking server alive");
});

app.post("/join", (req, res) => {
    const name = req.body?.name;

    console.log("incoming:", req.body);
    console.log("queue before:", queue);

    if (!name) {
        return res.json({
            error: "no name provided"
        });
    }

    // if someone already waiting → match
    if (queue.length > 0) {
        const opponent = queue.shift();

        console.log("MATCH:", name, "vs", opponent);

        return res.json({
            match: true,
            opponent: opponent.name
        });
    }

    // add player to queue
    queue.push({ name });

    console.log("queued:", name);

    return res.json({
        match: false
    });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log("running on port " + PORT);
});