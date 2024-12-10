const crypto = require('crypto');

export const generateRandomString = (length) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

