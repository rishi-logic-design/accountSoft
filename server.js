const express = require("express");
require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");
const { sequelize } = require("./models/");
const errorMiddleware = require("./middleware/errorMiddleware");
app.use("/uploads", express.static("uploads"));

// Vendor Routes
const authRoutes = require("./routes/Vendors/authRoutes");
const vendorRoutes = require("./routes/Vendors/vendorRoutes");
const subscriptionRoutes = require("./routes/Vendors/subcriptionRoutes");
const dashboardRoutes = require("./routes/Vendors/dashboardRoutes");
const customerRoutes = require("./routes/Vendors/customerRoutes");
const challanRoutes = require("./routes/Vendors/challanRoutes");
const billRoutes = require("./routes/Vendors/billRoutes");
const paymentRoutes = require("./routes/Vendors/paymentRoutes");
const settingsRoutes = require("./routes/Vendors/settingsRoutes");
const createBillRoutes = require("./routes/Vendors/billRoutes");

// Customer Routes
const transactionRoutes = require("./routes/Customer/transactionRoutes");
const summaryRoutes = require("./routes/Customer/summaryRoutes");

// Admin Routes
const adminAuthRoutes = require("./routes/Vendors/authRoutes");

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Vendor Routes
app.use("/auth", authRoutes);
app.use("/vendors", vendorRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/challans", challanRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/bills/create", createBillRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/summary", summaryRoutes);

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await sequelize.sync();
    console.log("✅ Database connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(
        `🌍 Frontend URL: ${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }`
      );
    });
  } catch (err) {
    console.error("❌ DB connection failed:", err);
  }
})();
