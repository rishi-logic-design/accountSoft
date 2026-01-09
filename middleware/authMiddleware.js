require("dotenv").config();
const jwt = require("jsonwebtoken");
const { UserModel, VendorModel, CustomerModel } = require("../models");

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

    switch (decoded.role) {
      case "admin":
      case "superadmin":
        const admin = await UserModel.findByPk(decoded.id);

        if (!admin) {
          return res.status(401).json({
            success: false,
            message: "Admin user not found",
          });
        }

        if (!admin.isActive) {
          return res.status(403).json({
            success: false,
            message: "Your account is inactive",
          });
        }

        req.user = {
          id: admin.id,
          role: admin.role,
          name: admin.name,
          email: admin.email,
          mobile: admin.mobile,
        };
        req.authRole = admin.role;
        break;

      case "vendor":
        const vendor = await VendorModel.findByPk(
          decoded.id || decoded.vendorId
        );

        if (!vendor) {
          return res.status(401).json({
            success: false,
            message: "Vendor not found",
          });
        }

        if (vendor.status !== "Active") {
          return res.status(403).json({
            success: false,
            message: "Your vendor account is inactive",
          });
        }

        if (vendor.expiryDate) {
          const expiryDate = new Date(vendor.expiryDate);
          const today = new Date();

          if (expiryDate < today) {
            return res.status(403).json({
              success: false,
              message: "Your subscription has expired. Please renew.",
            });
          }
        }

        req.user = {
          id: vendor.id,
          role: "vendor",
          name: vendor.vendorName,
          businessName: vendor.businessName,
          email: vendor.email,
          mobile: vendor.mobile,
          vendorId: vendor.id,
        };
        req.authRole = "vendor";
        break;

      case "customer":
        const customer = await CustomerModel.findByPk(
          decoded.id || decoded.customerId,
          {
            include: [
              {
                model: VendorModel,
                as: "vendor",
                attributes: [
                  "id",
                  "vendorName",
                  "businessName",
                  "status",
                  "expiryDate",
                ],
              },
            ],
          }
        );

        if (!customer) {
          return res.status(401).json({
            success: false,
            message: "Customer not found",
          });
        }

        if (!customer.isActive) {
          return res.status(403).json({
            success: false,
            message: "Your customer account is inactive",
          });
        }

        if (customer.vendor && customer.vendor.status !== "Active") {
          return res.status(403).json({
            success: false,
            message:
              "Your vendor account is inactive. Please contact your business.",
          });
        }

        if (customer.vendor && customer.vendor.expiryDate) {
          const expiryDate = new Date(customer.vendor.expiryDate);
          const today = new Date();

          if (expiryDate < today) {
            return res.status(403).json({
              success: false,
              message:
                "Your vendor subscription has expired. Please contact your business.",
            });
          }
        }

        req.user = {
          id: customer.id,
          role: "customer",
          name: customer.customerName,
          businessName: customer.businessName,
          email: customer.email,
          mobile: customer.mobileNumber,
          customerId: customer.id,
          vendorId: customer.vendorId,
        };
        req.customer = customer;
        req.authRole = "customer";
        break;
      default:
        return res.status(403).json({
          success: false,
          message: "Invalid user role in token",
        });
    }
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};
