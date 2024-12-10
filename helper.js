const crypto = require('crypto');

const generateRandomString = (length = 16) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}



const helper = { generateRandomString }
module.exports = helper
