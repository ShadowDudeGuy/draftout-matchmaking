import express from "express";
import cors from "cors";

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// queue + match storage
let queue = [];
let matches = new Map();  // name -> opponent name
let drafts = new Map();   // matchKey -> draftState

// matchKey is always the two names sorted alphabetically, so both players share one draft
function matchKey(a, b) {
    return [a, b].sort().join("::");
}

function createDraft(player1, player2) {
    return {
        player1,          // the player who joined second (got the match response)
        player2,          // the player who was waiting in queue
        currentTurn: player1,  // player1 picks first
        turnStartTime: Date.now(),
        roundLimit: 1,
        picksInCurrentRound: 0,
        turnDurationMs: 10000,
    };
}

function getOpponent(draft, name) {
    return draft.player1 === name ? draft.player2 : draft.player1;
}

function advanceTurn(draft) {
    draft.picksInCurrentRound++;
    draft.turnStartTime = Date.now();

    if (draft.picksInCurrentRound >= draft.roundLimit) {
        draft.currentTurn = getOpponent(draft, draft.currentTurn);
        draft.picksInCurrentRound = 0;
        draft.roundLimit = 2; // after first round, always 2 picks per turn (snake)
    }
}

app.get("/", (req, res) => {
    res.send("Matchmaking server is online.");
});


// JOIN ROUTE
app.post("/join", (req, res) => {
    const name = req.body?.name;

    console.log("JOIN:", req.body);

    if (!name) {
        return res.status(400).json({ error: "no name provided" });
    }

    if (queue.length > 0) {
        const opponent = queue.shift();

        matches.set(name, opponent.name);
        matches.set(opponent.name, name);

        const key = matchKey(name, opponent.name);
        const draft = createDraft(name, opponent.name);
        drafts.set(key, draft);

        console.log("MATCH:", name, "vs", opponent.name, "| Draft created, first turn:", draft.currentTurn);

        return res.json({
            match: true,
            opponent: opponent.name
        });
    }

    queue.push({ name });

    console.log("QUEUED:", name);

    return res.json({ match: false });
});


// STATUS ROUTE
app.post("/status", (req, res) => {
    const name = req.body?.name;

    if (!name) {
        return res.status(400).json({ error: "no name provided" });
    }

    const opponent = matches.get(name);

    if (opponent) {
        return res.json({ match: true, opponent });
    }

    return res.json({ match: false });
});


// DRAFT STATE ROUTE — clients poll this to sync turn
app.post("/draft/state", (req, res) => {
    const name = req.body?.name;

    if (!name) {
        return res.status(400).json({ error: "no name provided" });
    }

    const opponent = matches.get(name);
    if (!opponent) {
        return res.status(404).json({ error: "no active match for this player" });
    }

    const key = matchKey(name, opponent);
    const draft = drafts.get(key);
    if (!draft) {
        return res.status(404).json({ error: "no draft found for this match" });
    }

    // Server-side timer expiry — if the current player ran out of time, advance the turn
    const elapsed = Date.now() - draft.turnStartTime;
    if (elapsed >= draft.turnDurationMs) {
        console.log("TURN TIMEOUT — advancing from", draft.currentTurn);
        advanceTurn(draft);
    }

    const isMyTurn = draft.currentTurn === name;
    const timeRemaining = Math.max(0, draft.turnDurationMs - (Date.now() - draft.turnStartTime));

    return res.json({
        isMyTurn,
        currentTurn: draft.currentTurn,
        timeRemaining,
        turnDurationMs: draft.turnDurationMs,
    });
});


// DRAFT PICK ROUTE — client calls this when a pick is made
app.post("/draft/pick", (req, res) => {
    const name = req.body?.name;

    if (!name) {
        return res.status(400).json({ error: "no name provided" });
    }

    const opponent = matches.get(name);
    if (!opponent) {
        return res.status(404).json({ error: "no active match for this player" });
    }

    const key = matchKey(name, opponent);
    const draft = drafts.get(key);
    if (!draft) {
        return res.status(404).json({ error: "no draft found for this match" });
    }

    if (draft.currentTurn !== name) {
        return res.status(403).json({ error: "not your turn" });
    }

    advanceTurn(draft);

    console.log("PICK by", name, "| Now:", draft.currentTurn, "picks turn");

    return res.json({
        ok: true,
        currentTurn: draft.currentTurn,
    });
});


// LEAVE ROUTE
app.post("/leave", (req, res) => {
    const name = req.body?.name;
    const opponent = matches.get(name);

    if (opponent) {
        const key = matchKey(name, opponent);
        drafts.delete(key);
        matches.delete(opponent);
    }

    matches.delete(name);
    queue = queue.filter(p => p.name !== name);

    res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});