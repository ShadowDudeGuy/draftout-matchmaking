import express from "express";
import cors from "cors";

const app = express();

// Middleware - MUST be before your routes
app.use(cors());
app.use(express.json());

let queue = [];

app.get("/", (req, res) => {
    res.send("Matchmaking server is online.");
});

app.post("/join", (req, res) => {
    const name = req.body?.name;

    // Log the body to your Render dashboard to debug the "incoming: {}" issue
    console.log("Incoming Body:", req.body);

    if (!name) {
        return res.status(400).json({
            error: "no name provided"
        });
    }

    // if someone is already waiting
    if (queue.length > 0) {
        const opponent = queue.shift();

        console.log(`MATCH FOUND: ${name} vs ${opponent.name}`);

        return res.json({
            match: true,
            opponent: opponent.name // Accessing the name property correctly
        });
    }

    // Add player as an object so the queue stays consistent
    queue.push({ name });

    console.log(`Player queued: ${name}. Queue size: ${queue.length}`);

    return res.json({
        match: false
    });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
