const express = require("express");
const axios = require("axios");
const helmet = require("helmet");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const querystring = require("querystring");
const redis = require('redis')
const { v4: uuidv4 } = require('uuid')
const helper = require('helper')

dotenv.config();

const app = express();

app.use(bodyParser.json());

const redisClient = redis.createClient()

redisClient.connect().then(result => {
  console.log('connected to redis on localhost:6379')
}).catch(e => {
  console.error(e)
  return
})

const isValidState = async (tempId, state) => {
  try {
    const res = await redisClient.get(tempId)
    return res === state
  } catch (e) {
    console.error('redis error', e)
    return null
  }
}

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT = process.env.PORT || 3000;

if (!CLIENT_ID || !CLIENT_SECRET) return;

app.use(helmet());

const exchangeCodeForToken = async (code) => {
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
};

app.get('/oauth/start', async (req, res) => {
  const state = helper.generateRandomString()

  try {
    const tempId = uuidv4()
    await redisClient.set(tempId, state)

    const githubAuthUrl = `https://github.com/login/oauth/authorize?state=${state}&tempId=${tempId}`
    res.redirect(githubAuthUrl)

  } catch (e) {
    console.error('redis error', e)
    return res.status(500).send('Internal error')
  }
})

app.get('/oauth/callback', async (req, res) => {
  const { code, state, tempId } = req.query

  const result = await isValidState(tempId, state)
  // error
  if (result === null) res.json(500).send('internal error')

  if (!result) {
    return res.status(400).send("Invalid state")
  }

  try {
    const token = await exchangeCodeForToken(code)
    res.json({ token })
  } catch (er) {
    res.status(500).send('Token exchange failed')
  }

})


app.post("/refresh-token", async (req, res) => {
  const { refresh_token: refreshToken } = req.body;
  console.log("found refresh token:", refreshToken);
  fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })
    .then((response) => response.text())
    .then((data) => {
      const myResponse = querystring.parse(data);
      console.log("found data", data);
      // Store the new bearer_token and refresh_token
      res.json(myResponse);
    })
    .catch((e) => {
      console.error(`error refreshing token ${e}`);
    });
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
