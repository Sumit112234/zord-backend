// middleware/sanitizeRequest.js

const sanitize = (obj = {}) => {
  for (let key in obj) {
    if (
      typeof key === "string" &&
      (key.startsWith("$") || key.includes("."))
    ) {
      delete obj[key]
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitize(obj[key]) // recursively sanitize nested objects
    }
  }
  return obj
}

const sanitizeRequest = (req, res, next) => {
  req.body = sanitize({ ...req.body })
  req.params = sanitize({ ...req.params })
  req.query = sanitize({ ...req.query }) // don't mutate req.query directly
  next()
}

module.exports = sanitizeRequest
