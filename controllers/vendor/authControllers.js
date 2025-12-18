const jwt = require("jsonwebtoken");
require("dotenv").config();
const { UserModel } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const settingsService = require("../../services/vendor/settingsService");
const { generateOtp, otpExpiryMinutes } = require("../../utils/otpUtils");

exports.register = asyncHandler(async (req, res) => {
  const { name, email, role, mobile } = req.body;
  if (!name || !mobile) {
    return error(res, "Name and mobile are required", 400);
  }

  // Check mobile format
  const mobileRegex = /^[0-9]{10,15}$/;
  if (!mobileRegex.test(mobile)) {
    return error(res, "Invalid mobile number format", 400);
  }

  // Check existing mobile
  const existingMobile = await UserModel.findOne({ where: { mobile } });
  if (existingMobile) {
    return error(res, "Mobile number already exists", 400);
  }

  // Check existing email (if provided)
  if (email) {
    const existingEmail = await UserModel.findOne({ where: { email } });
    if (existingEmail) {
      return error(res, "Email already exists", 400);
    }
  }

  // Create user without password
  const user = await UserModel.create({
    name,
    email: email || null,
    mobile,
    role: role || "vendor",
  });

  // Generate JWT token immediately after registration
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  console.log(`✅ New user registered: ${user.name} (${mobile})`);

  success(
    res,
    {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    },
    "User registered successfully",
    201
  );
});

exports.login = asyncHandler(async (req, res) => {
  const { mobile, email } = req.body;

  if (!mobile && !email) {
    return error(res, "Mobile/Email is required", 400);
  }

  const whereCondition = mobile ? { mobile } : { email };
  const user = await UserModel.findOne({ where: whereCondition });

  if (!user) return error(res, "Invalid credentials", 401);

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
  success(
    res,
    {
      token,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
      },
    },
    "Logged in"
  );
});

exports.getFirm = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;
  if (!vendorId) return error(res, "Unauthorized", 401);
  const firm = await settingsService.getFirm(vendorId);
  success(res, { firm }, "Firm fetched");
});

exports.upsertFirm = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;
  if (!vendorId) return error(res, "Unauthorized", 401);
  const payload = req.body || {};
  const saved = await settingsService.upsertFirm(vendorId, payload);
  success(res, { firm: saved }, "Firm upserted");
});

exports.createGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;
  if (!vendorId) return error(res, "Unauthorized", 401);
  const payload = req.body || {};
  const created = await settingsService.createGstSlab(vendorId, payload);
  success(res, { gst: created }, "GST slab created", 201);
});

exports.listGstSlabs = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;
  if (!vendorId) return error(res, "Unauthorized", 401);
  const includeInactive =
    req.query &&
    (req.query.includeInactive === "true" || req.query.includeInactive === "1");
  const list = await settingsService.listGstSlabs(vendorId, {
    includeInactive,
  });
  success(res, { gst: list }, "GST slabs listed");
});

exports.getGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;
  if (!vendorId) return error(res, "Unauthorized", 401);
  const { id } = req.params;
  const slab = await settingsService.getGstSlab(vendorId, Number(id));
  success(res, { gst: slab }, "GST slab fetched");
});

exports.updateGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;
  if (!vendorId) return error(res, "Unauthorized", 401);
  const { id } = req.params;
  const payload = req.body || {};
  const updated = await settingsService.updateGstSlab(
    vendorId,
    Number(id),
    payload
  );
  success(res, { gst: updated }, "GST slab updated");
});

exports.deleteGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;
  if (!vendorId) return error(res, "Unauthorized", 401);
  const { id } = req.params;

  const hard =
    req.query && (req.query.hard === "true" || req.query.hard === "1");
  await settingsService.deleteGstSlab(vendorId, Number(id), !hard);
  success(res, { id: Number(id) }, "GST slab deleted");
});

const otpStore = new Map();

exports.sendOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return error(res, "Mobile number is required", 400);
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobile)) {
    return error(res, "Invalid mobile number format", 400);
  }

  const user = await UserModel.findOne({ where: { mobile } });

  if (!user) {
    return error(res, "User not found", 404);
  }

  if (user.role !== "admin" && user.role !== "superadmin") {
    return error(res, "Unauthorized access", 403);
  }

  const otp = generateOtp(6);
  const expireAt = Date.now() + otpExpiryMinutes * 60 * 1000;

  otpStore.set(mobile, { otp, expireAt, attempts: 0 });

  console.log(`OTP for ${mobile}: ${otp}`);

  success(
    res,
    {
      message: "OTP sent successfully to your mobile",
      expiresIn: `${otpExpiryMinutes} minutes`,
    },
    "OTP Sent"
  );
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    return error(res, "Mobile number and OTP are required", 400);
  }

  const storedData = otpStore.get(mobile);

  if (!storedData) {
    return error(res, "No OTP request found for this mobile number", 404);
  }

  if (Date.now() > storedData.expireAt) {
    otpStore.delete(mobile);
    return error(res, "OTP has expired", 400);
  }

  if (storedData.attempts >= 3) {
    otpStore.delete(mobile);
    return error(res, "Maximum OTP verification attempts exceeded", 429);
  }

  if (storedData.otp !== otp) {
    storedData.attempts += 1;
    return error(res, "Invalid OTP", 400);
  }

  const user = await UserModel.findOne({ where: { mobile } });

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return error(res, "Unauthorized user", 403);
  }

  otpStore.delete(mobile);

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  success(
    res,
    {
      token,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
      },
    },
    "Login successful"
  );
});

exports.resendOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return error(res, "Mobile number is required", 400);
  }

  otpStore.delete(mobile);

  return exports.sendOtp(req, res);
});

exports.checkUserRole = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return error(res, "Mobile number is required", 400);
  }

  const user = await UserModel.findOne({ where: { mobile } });

  if (!user) {
    return error(res, "User not found. Please contact administrator.", 404);
  }

  if (user.role !== "admin" && user.role !== "superadmin") {
    return error(res, "You are not authorized to access admin panel", 403);
  }

  success(
    res,
    {
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
      },
    },
    "User verified"
  );
});
