require("dotenv").config({
  path:
    process.env.NODE_ENV === "production"
      ? ".env.production"
      : ".env.development",
});
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { sequelize } = require("./models");
const errorMiddleware = require("./middleware/errorMiddleware");
const path = require("path");
// Routes
const authRoutes = require("./routes/Vendors/authRoutes");
const vendorRoutes = require("./routes/Vendors/vendorRoutes");
const subscriptionRoutes = require("./routes/Vendors/subcriptionRoutes");
const dashboardRoutes = require("./routes/Vendors/dashboardRoutes");
const customerRoutes = require("./routes/Vendors/customerRoutes");
const challanRoutes = require("./routes/Vendors/challanRoutes");
const billRoutes = require("./routes/Vendors/billRoutes");
const paymentRoutes = require("./routes/Vendors/paymentRoutes");
const firmRoutes = require("./routes/Vendors/firmRoutes");
const gstSlabRoutes = require("./routes/Vendors/gstSlabRoutes");
const uploadRoutes = require("./routes/Vendors/uploadRoutes");
const transactionRoutes = require("./routes/Customer/transactionRoutes");
const summaryRoutes = require("./routes/Customer/summaryRoutes");
const productRoutes = require("./routes/Vendors/productRoutes");
const LengerRoutes = require("./routes/Vendors/ledgerRoutes");
const vendorPaymentRoutes = require("./routes/Vendors/vendorPaymentRoutes");
const vendorGstNumberRoutes = require("./routes/Vendors/vendorGstNumberRoutes");
const vendorProfileImageRoutes = require("./routes/Vendors/vendorProfileImageRoutes");
const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({
    status: "Server is running",
    env: process.env.NODE_ENV,
    dbConnected: sequelize
      .authenticate()
      .then(() => true)
      .catch(() => false),
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// Routes
app.use("/uploads", express.static("uploads"));
app.use("/auth", authRoutes);
app.use("/vendors", vendorRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/challans", challanRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/firm", firmRoutes);
app.use("/api/gst-slabs", gstSlabRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/products", productRoutes);
app.use("/api/ledger", LengerRoutes);
app.use("/api/vendor-gst-numbers", vendorGstNumberRoutes);
app.use("/api/vendor-payments", vendorPaymentRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/", vendorProfileImageRoutes);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    console.log("🔄 Connecting to database...");
    await sequelize.authenticate();
    console.log("✅ Database connected successfully");
    await sequelize.sync();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    console.error("❌ Startup Error:", err.message);
    console.error("Full Error:", err);
    process.exit(1);
  }
})();
