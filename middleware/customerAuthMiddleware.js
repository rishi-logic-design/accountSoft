require("dotenv").config();
const jwt = require("jsonwebtoken");
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === "customer") {
      const customer = await CustomerModel.findByPk(decoded.id);

      if (!customer) {
        return res.status(401).json({
          success: false,
          message: "Customer not found",
        });
      }

      /*
      if (!customer.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your customer account is inactive",
        });
      }
      */

      req.customer = customer;
      req.user = {
        id: customer.id,
        role: "customer",
        name: customer.customerName,
        businessName: customer.businessName,
        email: customer.email,
        mobile: customer.mobileNumber,
        customerId: customer.id,
        vendorId: customer.createdBy, 
      };
      req.authRole = "customer";
      return next();
    }

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
