import express from "express";
import cors from "cors";

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// queue + match storage
let queue = [];
let matches = new Map();

app.get("/", (req, res) => {
    res.send("Matchmaking server is online.");
});


// JOIN ROUTE
app.post("/join", (req, res) => {
    const name = req.body?.name;

    console.log("JOIN:", req.body);

    if (!name) {
        return res.status(400).json({
            error: "no name provided"
        });
    }

    // if someone waiting → create match
    if (queue.length > 0) {
        const opponent = queue.shift();

        matches.set(name, opponent.name);
        matches.set(opponent.name, name);

        console.log("MATCH:", name, "vs", opponent.name);

        return res.json({
            match: true,
            opponent: opponent.name
        });
    }

    // otherwise queue player
    queue.push({ name });

    console.log("QUEUED:", name);

    return res.json({
        match: false
    });
});


// STATUS ROUTE (THIS FIXES YOUR ISSUE)
app.post("/status", (req, res) => {
    const name = req.body?.name;

    if (!name) {
        return res.status(400).json({
            error: "no name provided"
        });
    }

    const opponent = matches.get(name);

    if (opponent) {
        return res.json({
            match: true,
            opponent
        });
    }

    return res.json({
        match: false
    });
});


// optional cleanup (prevents memory leaks)
app.post("/leave", (req, res) => {
    const name = req.body?.name;

    matches.delete(name);
    queue = queue.filter(p => p.name !== name);

    res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});