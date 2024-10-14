const express = require("express");
const axios = require("axios");
const helmet = require("helmet");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");

dotenv.config();

const app = express();

app.use(bodyParser.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT = process.env.PORT || 3000;

if (!CLIENT_ID || !CLIENT_SECRET) return;

app.use(helmet());

app.post("/exchange-github-code", async (req, res) => {
  const { code } = req.body;

  try {
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to exchange code for token" });
  }
});

app.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;
  fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      // Store the new bearer_token and refresh_token
      res.json(response.data);
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
