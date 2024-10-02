const express = require("express");
const axios = require("axios");
const app = express();

const CLIENT_ID = "your_client_id";
const CLIENT_SECRET = "your_client_secret";

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

app.listen(3000, () => console.log("Server running on port 3000"));
