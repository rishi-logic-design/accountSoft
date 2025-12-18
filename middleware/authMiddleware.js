const jwt = require("jsonwebtoken");
require("dotenv").config();

// Vendor / Admin User Model
const { UserModel } = require("../models/vendor/userModel");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("DECODED TOKEN =>", decoded);

    const user = await UserModel.findByPk(decoded.id);
    console.log("USER FOUND =>", user);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found for this token",
      });
    }

    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token invalid or expired",
    });
  }
};
