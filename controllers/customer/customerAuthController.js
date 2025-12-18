const asyncHandler = require("../utils/asyncHandler");
const { success, error } = require("../utils/apiResponse");
const { CustomerModel, CustomerOtpModel } = require("../models");
const { generateOtp, otpExpiryMinutes } = require("../utils/otp.util");
const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.requestOtp = asyncHandler(async (req, res) => {
  const { mobileNumber } = req.body;
  if (!mobileNumber) return error(res, "mobileNumber required", 400);

  // try to find existing customer by mobile (optional)
  const customer = await CustomerModel.findOne({ where: { mobileNumber } });

  // create OTP record
  const otp = generateOtp(6);
  const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

  await CustomerOtpModel.create({
    customerId: customer ? customer.id : null,
    mobileNumber,
    otp,
    expiresAt,
  });

  success(
    res,
    { message: `OTP generated and sent to ${mobileNumber}.`, otpDebug: otp },
    "OTP sent"
  );
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { mobileNumber, otp } = req.body;
  if (!mobileNumber || !otp)
    return error(res, "mobileNumber and otp required", 400);

  const record = await CustomerOtpModel.findOne({
    where: { mobileNumber, otp, used: false },
    order: [["createdAt", "DESC"]],
  });

  if (!record) return error(res, "Invalid OTP", 400);
  if (new Date(record.expiresAt) < new Date())
    return error(res, "OTP expired", 400);

  // mark used
  await record.update({ used: true });

  let customer = await CustomerModel.findOne({ where: { mobileNumber } });
  if (!customer) {
    customer = await CustomerModel.create({
      customerName: `Customer_${mobileNumber.slice(-4)}`,
      mobileNumber,
      createdBy: null, // no vendor mapping yet - optional
    });
  }

  // generate JWT
  const token = jwt.sign(
    { id: customer.id, role: "customer" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
  );

  success(res, { token, customer }, "OTP verified");
});
