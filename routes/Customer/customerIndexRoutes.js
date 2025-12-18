const express = require("express");
const router = express.Router();

const authRoutes = require("./customerAuth.routes");
const customerAppRoutes = require("./customerApp.routes");

router.use("/auth", authRoutes);
router.use("/", customerAppRoutes); 

module.exports = router;
