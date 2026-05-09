import express from "express";

const app = express();
app.use(express.json());

let queue = [];

app.post("/join", (req, res) => {
    let name = req.body.name;

    if (queue.length > 0) {
        let opponent = queue.shift();

        return res.json({
            match: true,
            opponent
        });
    }

    queue.push(name);

    res.json({
        match: false
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("running on port " + PORT);
});