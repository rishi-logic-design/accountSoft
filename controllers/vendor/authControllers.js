require("dotenv").config();
const jwt = require("jsonwebtoken");
const { UserModel, VendorModel, CustomerModel } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { generateOtp, otpExpiryMinutes } = require("../../utils/otpUtils");

exports.register = asyncHandler(async (req, res) => {
  const { name, email, role, mobile } = req.body;

  console.log("📥 Register Request:", { name, email, mobile, role });

  // Validation
  if (!name || !email || !mobile) {
    return error(res, "Name, email and mobile are required", 400);
  }

  // Check existing email
  const existingEmail = await UserModel.findOne({ where: { email } });
  if (existingEmail) {
    return error(res, "Email already exists", 400);
  }

  // Check existing mobile
  const existingMobile = await UserModel.findOne({ where: { mobile } });
  if (existingMobile) {
    return error(res, "Mobile number already exists", 400);
  }

  // Create user
  const user = await UserModel.create({
    name,
    email,
    mobile,
    role: role || "admin",
  });

  console.log("✅ User created:", user.id);

  success(
    res,
    {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
    },
    "User created successfully",
    201,
  );
});

exports.login = asyncHandler(async (req, res) => {
  const { mobile, email } = req.body;

  if (!mobile && !email) {
    return error(res, "Mobile/Email required", 400);
  }

  const whereCondition = mobile ? { mobile } : { email };
  const user = await UserModel.findOne({ where: whereCondition });

  if (!user) return error(res, "Invalid credentials", 401);

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
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
    "Logged in",
  );
});

exports.exchangeFirebaseToken = asyncHandler(async (req, res) => {
  const { mobile, firebaseUid } = req.body;

  if (!mobile || !firebaseUid) {
    return error(res, "Mobile number and Firebase UID are required", 400);
  }

  // Try to find user in Users table
  const user = await UserModel.findOne({ where: { mobile } });

  if (user) {
    // Generate JWT token for any user (removed role restriction)
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    return success(
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
      "Token generated",
    );
  }

  // Try to find in Vendors table
  const vendor = await VendorModel.findOne({ where: { mobile } });

  if (vendor) {
    if (vendor.status !== "Active") {
      return error(res, "Your account is inactive", 403);
    }

    // Check expiry
    if (vendor.expiryDate) {
      const expiryDate = new Date(vendor.expiryDate);
      const today = new Date();

      if (expiryDate < today) {
        return error(res, "Your subscription has expired", 403);
      }
    }

    const token = jwt.sign(
      {
        id: vendor.id,
        role: "vendor",
        vendorId: vendor.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    return success(
      res,
      {
        token,
        vendor: {
          id: vendor.id,
          vendorName: vendor.vendorName,
          businessName: vendor.businessName,
          mobile: vendor.mobile,
          email: vendor.email,
          status: vendor.status,
          expiryDate: vendor.expiryDate,
        },
      },
      "Token generated successfully",
    );
  }

  // Try to find in Customers table
  const customer = await CustomerModel.findOne({
    where: { mobileNumber: mobile },
    include: [
      {
        model: require("../../models").VendorModel,
        as: "vendor",
        attributes: ["id", "vendorName", "businessName", "status"],
      },
    ],
  });

  if (customer) {
    if (customer.vendor && customer.vendor.status !== "Active") {
      return error(
        res,
        "Your vendor account is inactive. Please contact your business.",
        403,
      );
    }

    const token = jwt.sign(
      {
        id: customer.id,
        role: "customer",
        customerId: customer.id,
        vendorId: customer.vendorId || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    return success(
      res,
      {
        token,
        customer: {
          id: customer.id,
          customerName: customer.customerName,
          businessName: customer.businessName,
          mobile: customer.mobileNumber,
          email: customer.email,
          vendor: {
            id: customer.vendor?.id,
            name: customer.vendor?.vendorName,
            businessName: customer.vendor?.businessName,
          },
        },
      },
      "Token generated successfully",
    );
  }

  return error(res, "User not found", 404);
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
    "OTP Sent",
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
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
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
    "Login successful",
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

  console.log("📥 checkUserRole API called");
  console.log("📱 Mobile received:", mobile);

  if (!mobile) {
    console.log("❌ Mobile number missing");
    return error(res, "Mobile number is required", 400);
  }

  const user = await UserModel.findOne({ where: { mobile } });

  if (!user) {
    console.log("❌ User not found for mobile:", mobile);
    return error(res, "User not found. Please contact administrator.", 404);
  }

  console.log("👤 User found:", {
    id: user.id,
    name: user.name,
    role: user.role,
  });

  if (user.role !== "admin" && user.role !== "superadmin") {
    console.log("🚫 Unauthorized access attempt. Role:", user.role);
    return error(res, "You are not authorized to access admin panel", 403);
  }

  console.log("✅ Admin access granted for user:", user.mobile);

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
    "User verified",
  );
});

exports.checkVendor = asyncHandler(async (req, res) => {
  const { mobile } = req.body || {};

  console.log("🔥 checkVendor API called");
  console.log("📱 Mobile received:", mobile);

  if (!mobile) {
    console.log("❌ Mobile number missing");
    return error(res, "Mobile number is required", 400);
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobile)) {
    return error(res, "Invalid mobile number format. Must be 10 digits", 400);
  }

  // Check in Vendor table
  const vendor = await VendorModel.findOne({ where: { mobile } });

  if (!vendor) {
    console.log("❌ Vendor not found for mobile:", mobile);
    return error(res, "Vendor not found. Please contact administrator.", 404);
  }

  console.log("👤 Vendor found:", {
    id: vendor.id,
    vendorName: vendor.vendorName,
    status: vendor.status,
  });

  // Check if vendor is active
  if (vendor.status !== "Active") {
    console.log("🚫 Vendor account is inactive");
    return error(
      res,
      "Your account is inactive. Please contact administrator.",
      403,
    );
  }

  // Check expiry date
  if (vendor.expiryDate) {
    const expiryDate = new Date(vendor.expiryDate);
    const today = new Date();

    if (expiryDate < today) {
      console.log("🚫 Vendor subscription expired");
      return error(res, "Your subscription has expired. Please renew.", 403);
    }
  }

  console.log("✅ Vendor verified successfully");

  success(
    res,
    {
      vendor: {
        id: vendor.id,
        vendorName: vendor.vendorName,
        businessName: vendor.businessName,
        mobile: vendor.mobile,
        email: vendor.email,
        status: vendor.status,
        expiryDate: vendor.expiryDate,
      },
    },
    "Vendor verified. You can proceed with OTP login.",
  );
});

exports.sendVendorOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  console.log("🔥 sendVendorOtp API called");
  console.log("📱 Mobile received:", mobile);

  if (!mobile) {
    return error(res, "Mobile number is required", 400);
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobile)) {
    return error(res, "Invalid mobile number format", 400);
  }

  // Check vendor exists and is active
  const vendor = await VendorModel.findOne({ where: { mobile } });

  if (!vendor) {
    return error(res, "Vendor not found", 404);
  }

  if (vendor.status !== "Active") {
    return error(res, "Your account is inactive", 403);
  }

  // Check expiry
  if (vendor.expiryDate) {
    const expiryDate = new Date(vendor.expiryDate);
    const today = new Date();

    if (expiryDate < today) {
      return error(res, "Your subscription has expired", 403);
    }
  }

  // Generate OTP
  const otp = generateOtp(6);
  const expireAt = Date.now() + otpExpiryMinutes * 60 * 1000;

  otpStore.set(mobile, {
    otp,
    expireAt,
    attempts: 0,
    type: "vendor",
    vendorId: vendor.id,
  });

  console.log(`🔐 Vendor OTP for ${mobile}: ${otp}`);
  console.log(`📝 OTP will expire in ${otpExpiryMinutes} minutes`);

  // In production, integrate with SMS gateway here
  // Example: await sendSMS(mobile, `Your OTP is: ${otp}`);

  success(
    res,
    {
      message: "OTP sent successfully to your mobile",
      expiresIn: `${otpExpiryMinutes} minutes`,
      // For development/testing only - remove in production
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    },
    "OTP Sent",
  );
});

exports.verifyVendorOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  console.log("🔥 verifyVendorOtp API called");
  console.log("📱 Mobile:", mobile);
  console.log("🔐 OTP:", otp);

  if (!mobile || !otp) {
    return error(res, "Mobile number and OTP are required", 400);
  }

  const storedData = otpStore.get(mobile);

  if (!storedData) {
    return error(res, "No OTP request found. Please request OTP again.", 404);
  }

  // Check if OTP expired
  if (Date.now() > storedData.expireAt) {
    otpStore.delete(mobile);
    return error(res, "OTP has expired. Please request a new one.", 400);
  }

  // Check max attempts
  if (storedData.attempts >= 3) {
    otpStore.delete(mobile);
    return error(
      res,
      "Maximum OTP verification attempts exceeded. Please request a new OTP.",
      429,
    );
  }

  // Verify OTP
  if (storedData.otp !== otp) {
    storedData.attempts += 1;
    console.log(`❌ Invalid OTP attempt ${storedData.attempts}/3`);
    return error(
      res,
      `Invalid OTP. ${3 - storedData.attempts} attempts remaining.`,
      400,
    );
  }

  // Check if this is vendor OTP
  if (storedData.type !== "vendor") {
    otpStore.delete(mobile);
    return error(res, "Invalid OTP type", 400);
  }

  // Get vendor details
  const vendor = await VendorModel.findByPk(storedData.vendorId);

  if (!vendor) {
    otpStore.delete(mobile);
    return error(res, "Vendor not found", 404);
  }

  if (vendor.status !== "Active") {
    otpStore.delete(mobile);
    return error(res, "Your account is inactive", 403);
  }

  // Clear OTP from store
  otpStore.delete(mobile);

  // Generate JWT token
  const token = jwt.sign(
    {
      id: vendor.id,
      role: "vendor",
      vendorId: vendor.id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );

  console.log("✅ Vendor login successful");

  success(
    res,
    {
      token,
      vendor: {
        id: vendor.id,
        vendorName: vendor.vendorName,
        businessName: vendor.businessName,
        mobile: vendor.mobile,
        email: vendor.email,
        status: vendor.status,
        expiryDate: vendor.expiryDate,
      },
    },
    "Login successful",
  );
});

exports.resendVendorOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  console.log("🔥 resendVendorOtp API called");
  console.log("📱 Mobile:", mobile);

  if (!mobile) {
    return error(res, "Mobile number is required", 400);
  }

  // Delete existing OTP
  otpStore.delete(mobile);

  // Send new OTP
  return exports.sendVendorOtp(req, res);
});

exports.exchangeVendorFirebaseToken = asyncHandler(async (req, res) => {
  const { mobile, firebaseUid } = req.body;

  console.log("🔥 exchangeVendorFirebaseToken API called");
  console.log("📱 Mobile:", mobile);
  console.log("🔥 Firebase UID:", firebaseUid);

  if (!mobile || !firebaseUid) {
    return error(res, "Mobile number and Firebase UID are required", 400);
  }

  // Check vendor exists
  const vendor = await VendorModel.findOne({ where: { mobile } });

  if (!vendor) {
    return error(res, "Vendor not found", 404);
  }

  if (vendor.status !== "Active") {
    return error(res, "Your account is inactive", 403);
  }

  // Check expiry
  if (vendor.expiryDate) {
    const expiryDate = new Date(vendor.expiryDate);
    const today = new Date();

    if (expiryDate < today) {
      return error(res, "Your subscription has expired", 403);
    }
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: vendor.id,
      role: "vendor",
      vendorId: vendor.id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );

  console.log("✅ Firebase token exchange successful");

  success(
    res,
    {
      token,
      vendor: {
        id: vendor.id,
        vendorName: vendor.vendorName,
        businessName: vendor.businessName,
        mobile: vendor.mobile,
        email: vendor.email,
        status: vendor.status,
        expiryDate: vendor.expiryDate,
      },
    },
    "Token generated successfully",
  );
});

exports.checkCustomer = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return error(res, "Mobile number is required", 400);
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobile)) {
    return error(res, "Invalid mobile number format. Must be 10 digits", 400);
  }

  const customer = await CustomerModel.findOne({
    where: { mobileNumber: mobile },
    include: [
      {
        model: require("../../models").VendorModel,
        as: "vendor",
        attributes: ["id", "vendorName", "businessName", "status"],
      },
    ],
  });

  if (!customer) {
    return error(
      res,
      "Customer not found. Please contact your vendor/business.",
      404,
    );
  }

  success(
    res,
    {
      customer: {
        id: customer.id,
        customerName: customer.customerName,
        businessName: customer.businessName,
        mobile: customer.mobileNumber,
        email: customer.email,
        vendor: {
          id: customer.vendor?.id,
          name: customer.vendor?.vendorName,
          businessName: customer.vendor?.businessName,
        },
      },
    },
    "Customer verified. You can proceed with OTP login.",
  );
});

exports.sendCustomerOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return error(res, "Mobile number is required", 400);
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobile)) {
    return error(res, "Invalid mobile number format", 400);
  }

  const customer = await CustomerModel.findOne({
    where: { mobileNumber: mobile },
    include: [
      {
        model: require("../../models").VendorModel,
        as: "vendor",
        attributes: ["status"],
      },
    ],
  });

  if (!customer) {
    return error(res, "Customer not found", 404);
  }

  if (customer.vendor && customer.vendor.status !== "Active") {
    return error(
      res,
      "Your vendor account is inactive. Please contact your business.",
      403,
    );
  }

  const otp = generateOtp(6);
  const expireAt = Date.now() + otpExpiryMinutes * 60 * 1000;

  otpStore.set(mobile, {
    otp,
    expireAt,
    attempts: 0,
    type: "customer",
    customerId: customer.id,
  });

  success(
    res,
    {
      message: "OTP sent successfully to your mobile",
      expiresIn: `${otpExpiryMinutes} minutes`,
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    },
    "OTP Sent",
  );
});

exports.verifyCustomerOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    return error(res, "Mobile number and OTP are required", 400);
  }

  const storedData = otpStore.get(mobile);

  if (!storedData) {
    return error(res, "No OTP request found. Please request OTP again.", 404);
  }

  if (Date.now() > storedData.expireAt) {
    otpStore.delete(mobile);
    return error(res, "OTP has expired. Please request a new one.", 400);
  }

  if (storedData.attempts >= 3) {
    otpStore.delete(mobile);
    return error(
      res,
      "Maximum OTP verification attempts exceeded. Please request a new OTP.",
      429,
    );
  }

  if (storedData.otp !== otp) {
    storedData.attempts += 1;
    console.log(`❌ Invalid OTP attempt ${storedData.attempts}/3`);
    return error(
      res,
      `Invalid OTP. ${3 - storedData.attempts} attempts remaining.`,
      400,
    );
  }
  if (storedData.type !== "customer") {
    otpStore.delete(mobile);
    return error(res, "Invalid OTP type", 400);
  }
  const customer = await CustomerModel.findByPk(storedData.customerId, {
    include: [
      {
        model: require("../../models").VendorModel,
        as: "vendor",
        attributes: ["id", "vendorName", "businessName", "status"],
      },
    ],
  });

  if (!customer) {
    otpStore.delete(mobile);
    return error(res, "Customer not found", 404);
  }

  if (customer.vendor && customer.vendor.status !== "Active") {
    otpStore.delete(mobile);
    return error(res, "Your vendor account is inactive", 403);
  }

  otpStore.delete(mobile);

  const token = jwt.sign(
    {
      id: customer.id,
      role: "customer",
      customerId: customer.id,
      vendorId: customer.vendorId || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );

  success(
    res,
    {
      token,
      customer: {
        id: customer.id,
        customerName: customer.customerName,
        businessName: customer.businessName,
        mobile: customer.mobileNumber,
        email: customer.email,
        gstNumber: customer.gstNumber,
        pricePerProduct: customer.pricePerProduct,
        vendor: {
          id: customer.vendor?.id,
          name: customer.vendor?.vendorName,
          businessName: customer.vendor?.businessName,
        },
      },
    },
    "Login successful",
  );
});

exports.resendCustomerOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return error(res, "Mobile number is required", 400);
  }

  otpStore.delete(mobile);

  return exports.sendCustomerOtp(req, res);
});

exports.exchangeCustomerFirebaseToken = asyncHandler(async (req, res) => {
  const { mobile, firebaseUid } = req.body;

  if (!mobile || !firebaseUid) {
    return error(res, "Mobile number and Firebase UID are required", 400);
  }

  const customer = await CustomerModel.findOne({
    where: { mobileNumber: mobile },
    include: [
      {
        model: require("../../models").VendorModel,
        as: "vendor",
        attributes: ["id", "vendorName", "businessName", "status"],
      },
    ],
  });

  if (!customer) {
    return error(res, "Customer not found", 404);
  }

  if (customer.vendor && customer.vendor.status !== "Active") {
    return error(
      res,
      "Your vendor account is inactive. Please contact your business.",
      403,
    );
  }

  const token = jwt.sign(
    {
      id: customer.id,
      role: "customer",
      customerId: customer.id,
      vendorId: customer.vendorId || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );

  success(
    res,
    {
      token,
      customer: {
        id: customer.id,
        customerName: customer.customerName,
        businessName: customer.businessName,
        mobile: customer.mobileNumber,
        email: customer.email,
        vendor: {
          id: customer.vendor?.id,
          name: customer.vendor?.vendorName,
          businessName: customer.vendor?.businessName,
        },
      },
    },
    "Token generated successfully",
  );
});

exports.getCustomerProfile = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  const customer = await CustomerModel.findByPk(customerId, {
    include: [
      {
        model: require("../../models").VendorModel,
        as: "vendor",
        attributes: ["id", "vendorName", "businessName", "email", "mobile"],
      },
    ],
  });

  if (!customer) {
    return error(res, "Customer not found", 404);
  }

  success(
    res,
    {
      customer: {
        id: customer.id,
        customerName: customer.customerName,
        businessName: customer.businessName,
        mobile: customer.mobileNumber,
        email: customer.email,
        gstNumber: customer.gstNumber,
        homeAddress: customer.homeAddress,
        officeAddress: customer.officeAddress,
        customerImage: customer.customerImage,
        pricePerProduct: customer.pricePerProduct,
        vendor: customer.vendor,
      },
    },
    "Profile retrieved successfully",
  );
});

exports.updateCustomerProfile = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  const customer = await CustomerModel.findByPk(customerId);

  if (!customer) {
    return error(res, "Customer not found", 404);
  }

  const allowedFields = [
    "customerName",
    "email",
    "homeAddress",
    "officeAddress",
    "customerImage",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  await customer.update(updateData);

  success(res, customer, "Profile updated successfully");
});
