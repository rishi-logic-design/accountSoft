const jwt = require("jsonwebtoken");
require("dotenv").config();

const { CustomerModel } = require("../models");
const { UserModel } = require("../models/vendor/userModel");

module.exports = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization || req.headers["x-customer-token"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🟢 CUSTOMER TOKEN
    if (decoded.role === "customer") {
      const customer = await CustomerModel.findByPk(decoded.id);

      if (!customer) {
        return res.status(401).json({
          success: false,
          message: "Customer not found",
        });
      }

      req.customer = customer;
      req.authRole = "customer";
      return next();
    }

    // 🟢 ADMIN / VENDOR TOKEN
    if (
      decoded.role === "admin" ||
      decoded.role === "vendor" ||
      decoded.role === "superadmin"
    ) {
      const user = await UserModel.findByPk(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      req.user = user;
      req.authRole = user.role;
      return next();
    }

    // ❌ Invalid role
    return res.status(403).json({
      success: false,
      message: "Invalid token role",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token invalid or expired",
    });
  }
};
