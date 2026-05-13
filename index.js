import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let queue = [];
let matches = new Map();
let drafts = new Map();

function generateSeed() {
  return Math.floor(Math.random() * 2 ** 32);
}

const ALL_GOALS = [
  { id: 0,  name: "Milk Bucket",       desc: "Get milk from a cow." },
  { id: 1,  name: "Spyglass",          desc: "Craft a Spyglass." },
  { id: 2,  name: "Rabbit Stew",       desc: "Craft Rabbit Stew." },
  { id: 3,  name: "Honey Bottle",      desc: "Harvest honey from a bee nest." },
  { id: 4,  name: "Crying Obsidian",   desc: "Obtain Crying Obsidian." },
  { id: 5,  name: "Slime Block",       desc: "Craft a Slime Block." },
  { id: 6,  name: "Clock",             desc: "Craft a Clock." },
  { id: 7,  name: "Golden Carrot",     desc: "Craft a Golden Carrot." },
  { id: 8,  name: "Cake",              desc: "Craft a Cake." },
  { id: 9,  name: "Crossbow",          desc: "Obtain a Crossbow." },
  { id: 10, name: "Firework Star",     desc: "Craft a Firework Star." },
  { id: 11, name: "Dried Kelp Block",  desc: "Craft a Dried Kelp Block." },
  { id: 12, name: "Amethyst Shard",    desc: "Mine an Amethyst Geode." },
  { id: 13, name: "Armor Stand",       desc: "Craft an Armor Stand." },
  { id: 14, name: "Suspicious Stew",   desc: "Craft or find Suspicious Stew." },
  { id: 15, name: "Magma Block",       desc: "Get a Magma Block from the Nether." },
  { id: 16, name: "Moss Block",        desc: "Find or trade for a Moss Block." },
  { id: 17, name: "Raw Copper",        desc: "Mine Raw Copper." },
  { id: 18, name: "Snowball",          desc: "Collect 16 Snowballs." },
  { id: 19, name: "Scaffolding",       desc: "Craft Scaffolding." },
  { id: 20, name: "Name Tag",          desc: "Find a Name Tag in a chest or by fishing." },
  { id: 21, name: "Pufferfish",        desc: "Catch a Pufferfish." },
  { id: 22, name: "Glazed Terracotta", desc: "Smelt dyed Terracotta." },
  { id: 23, name: "Pumpkin Pie",       desc: "Craft a Pumpkin Pie." },
  { id: 24, name: "Bookshelf",         desc: "Craft a Bookshelf." },
  { id: 25, name: "Lodestone",         desc: "Craft a Lodestone." },
  { id: 26, name: "Elytra",            desc: "Find Elytra in an End Ship." },
];

function matchKey(a, b) { return [a, b].sort().join("::"); }

function pickRandom(pool) {
  const idx = Math.floor(Math.random() * pool.length);
  return pool.splice(idx, 1)[0];
}

function generateOffer(draft) {
  if (draft.pool.length < 2) return null;
  const a = pickRandom(draft.pool);
  const b = pickRandom(draft.pool);
  draft.currentOffer = [a, b];
}

function createDraft(player1, player2) {
  const pool = ALL_GOALS.map(g => ({ ...g }));
  const draft = {
    player1,
    player2,
    currentTurn: player1,
    turnStartTime: Date.now(),
    roundLimit: 1,
    picksInCurrentRound: 0,
    turnDurationMs: 10000,
    pool,
    board: new Array(25).fill(null),
    currentOffer: null,
    seed: generateSeed(),
    completions: [], // { player, goalId, goalName }
  };

  generateOffer(draft);
  return draft;
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
    draft.roundLimit = 2;
  }

  generateOffer(draft);
}

function getDraftForPlayer(name) {
  const opponent = matches.get(name);
  if (!opponent) return null;
  return drafts.get(matchKey(name, opponent));
}

app.get("/", (req, res) => res.send("Matchmaking server is online."));

app.post("/join", (req, res) => {
  const name = req.body?.name;
  if (!name) return res.status(400).json({ error: "no name provided" });

  if (queue.length > 0) {
    const opponent = queue.shift();

    matches.set(name, opponent.name);
    matches.set(opponent.name, name);

    const key = matchKey(name, opponent.name);
    const draft = createDraft(name, opponent.name);

    drafts.set(key, draft);

    console.log("MATCH:", name, "vs", opponent.name, "seed:", draft.seed);

    return res.json({ match: true, opponent: opponent.name, seed: draft.seed });
  }

  queue.push({ name });
  console.log("QUEUED:", name);
  return res.json({ match: false });
});

app.post("/status", (req, res) => {
  const name = req.body?.name;
  if (!name) return res.status(400).json({ error: "no name provided" });

  const opponent = matches.get(name);
  if (opponent) return res.json({ match: true, opponent });

  return res.json({ match: false });
});

app.post("/draft/state", (req, res) => {
  const name = req.body?.name;
  if (!name) return res.status(400).json({ error: "no name provided" });

  const draft = getDraftForPlayer(name);
  if (!draft) return res.status(404).json({ error: "no draft found" });

  const elapsed = Date.now() - draft.turnStartTime;

  if (elapsed >= draft.turnDurationMs) {
    console.log("TURN TIMEOUT — auto-picking for", draft.currentTurn);

    if (draft.currentOffer && draft.currentOffer.length === 2) {
      const chosen = draft.currentOffer[Math.floor(Math.random() * 2)];
      const unchosen = draft.currentOffer.find(g => g.id !== chosen.id);

      const boardSlot = draft.board.findIndex(s => s === null);
      if (boardSlot !== -1) draft.board[boardSlot] = chosen;

      draft.pool.push(unchosen);
      draft.currentOffer = null;

      console.log(`AUTO-PICK: ${chosen.name} → board[${boardSlot}]`);
    }

    advanceTurn(draft);
  }

  const isMyTurn = draft.currentTurn === name;
  const timeRemaining = Math.max(0, draft.turnDurationMs - elapsed);

  return res.json({
    isMyTurn,
    currentTurn: draft.currentTurn,
    timeRemaining,
    turnDurationMs: draft.turnDurationMs,
    offer: draft.currentOffer,
    board: draft.board,
    seed: draft.seed,
    completions: draft.completions,
  });
});

app.post("/draft/complete", (req, res) => {
  const { name, goalId } = req.body;
  if (!name || goalId === undefined) {
    return res.status(400).json({ error: "name and goalId required" });
  }

  const draft = getDraftForPlayer(name);
  if (!draft) return res.status(404).json({ error: "no draft found" });

  const already = draft.completions.find(c => c.player === name && c.goalId === goalId);
  if (!already) {
    const goal = ALL_GOALS.find(g => g.id === goalId);
    draft.completions.push({ player: name, goalId, goalName: goal?.name ?? "Unknown" });
    console.log(`${name} completed: ${goal?.name}`);
  }

  return res.json({ ok: true });
});

app.post("/draft/pick", (req, res) => {
  const { name, goalId } = req.body;
  if (!name || goalId === undefined) {
    return res.status(400).json({ error: "name and goalId required" });
  }

  const draft = getDraftForPlayer(name);
  if (!draft) return res.status(404).json({ error: "no draft found" });
  if (draft.currentTurn !== name) return res.status(403).json({ error: "not your turn" });

  const offer = draft.currentOffer;
  if (!offer) return res.status(400).json({ error: "no active offer" });

  const chosenIdx = offer.findIndex(g => g.id === goalId);
  if (chosenIdx === -1) return res.status(400).json({ error: "goalId not in current offer" });

  const boardSlot = draft.board.findIndex(s => s === null);
  if (boardSlot !== -1) draft.board[boardSlot] = offer[chosenIdx];

  const unchosen = offer[1 - chosenIdx];
  draft.pool.push(unchosen);
  draft.currentOffer = null;

  advanceTurn(draft);

  console.log(`PICK by ${name}: ${offer[chosenIdx].name} → board[${boardSlot}]`);

  return res.json({ ok: true, boardSlot, pickedGoal: offer[chosenIdx] });
});

app.post("/leave", (req, res) => {
  const name = req.body?.name;
  const opponent = matches.get(name);

  if (opponent) {
    drafts.delete(matchKey(name, opponent));
    matches.delete(opponent);
  }

  matches.delete(name);
  queue = queue.filter(p => p.name !== name);

  res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port " + PORT));