const { body, validationResult } = require("express-validator")

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    })
  }
  next()
}

// Registration validation
const validateRegister = [
  body("name").trim().isLength({ min: 2, max: 50 }).withMessage("Name must be between 2 and 50 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
  body("collegeId").trim().notEmpty().withMessage("College ID is required"),
  body("collegeName").trim().notEmpty().withMessage("College name is required"),
  handleValidationErrors,
]

// Login validation
const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
]

// Post validation
const validatePost = [
  body("caption").optional().trim().isLength({ max: 2000 }).withMessage("Caption cannot exceed 2000 characters"),
  body("visibility")
    .optional()
    .isIn(["everyone", "collegeOnly", "studentsOnly"])
    .withMessage("Invalid visibility option"),
  handleValidationErrors,
]

// Comment validation
const validateComment = [
  body("content").trim().isLength({ min: 1, max: 500 }).withMessage("Comment must be between 1 and 500 characters"),
  handleValidationErrors,
]

// Profile update validation
const validateProfileUpdate = [
  body("name").optional().trim().isLength({ min: 2, max: 50 }).withMessage("Name must be between 2 and 50 characters"),
  body("bio").optional().trim().isLength({ max: 200 }).withMessage("Bio cannot exceed 200 characters"),
  handleValidationErrors,
]

module.exports = {
  validateRegister,
  validateLogin,
  validatePost,
  validateComment,
  validateProfileUpdate,
  handleValidationErrors,
}
