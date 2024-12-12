const express = require("express");
const axios = require("axios");
const helmet = require("helmet");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const querystring = require("querystring");
const redis = require('redis')
const { v4: uuidv4 } = require('uuid')
const helper = require('./helper.js')

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

const exchangeCodeForTokenData = async (code) => {
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

    console.log('response', response)
    return response.data
  } catch (error) {
    console.error("Failed to exchange code for token", error)
    return null
  }
};

app.get('/oauth/start', async (req, res) => {
  const state = helper.generateRandomString()
  const redirectUrl = 'https://repo-glance.navdeep.io/oauth/callback'

  try {
    const tempId = uuidv4()
    await redisClient.set(tempId, state)
    const stateData = JSON.stringify({ tempId, randomState: state })
    const encodedState = encodeURIComponent(Buffer.from(stateData).toString('base64'))

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&state=${encodedState}&scope=repo&redirect_uri=${encodeURIComponent(redirectUrl)}`

    res.redirect(githubAuthUrl)

  } catch (e) {
    console.error('redis error', e)
    return res.status(500).send('Internal error')
  }
})

app.get('/oauth/callback', async (req, res) => {
  // decode the state
  const { code, state: stateParam } = req.query
  const decodedState = JSON.parse(Buffer.from(decodeURIComponent(stateParam), 'base64').toString())
  const { tempId, randomState } = decodedState

  let result
  try {
    result = await isValidState(tempId, randomState)
    if (result) {
      // result is neither null nor false
      await redisClient.del(tempId)
    }
  } catch (e) {
    console.error('error retrieving tempId')
  }
  // error
  if (result === null) res.json(500).send('internal error')

  if (!result) {
    return res.status(400).send("Invalid state")
  }

  try {
    const data = await exchangeCodeForTokenData(code)
    const searchParams = new URLSearchParams(data)
    res.redirect(`/oauth/end?${searchParams.toString()}`)
  } catch (er) {
    console.error('error on successful redirect:', er)
    res.status(500).send('Token exchange failed')
  }

})

app.get('/oauth/end', async (req, res) => {
  const params = req.query

  res.status(200).send('Authorization complete, you may close this window')

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
