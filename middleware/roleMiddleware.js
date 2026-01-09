module.exports = (allowedRoles = []) => {
  return (req, res, next) => {
    console.log("🔐 Role Middleware Check");
    console.log("👤 User:", req.user);
    console.log("✅ Allowed Roles:", allowedRoles);

    if (!req.user) {
      console.log("❌ No user found in request");
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Authentication required",
      });
    }

    const userRole = req.user.role;
    console.log("🎭 User Role:", userRole);

    if (!allowedRoles || allowedRoles.length === 0) {
      console.log("✅ No role restriction - allowing authenticated user");
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      console.log("🚫 Access Denied - Insufficient permissions");
      console.log(`Required: ${allowedRoles.join(", ")} | Got: ${userRole}`);

      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
    }

    console.log("✅ Role check passed - Access granted");
    next();
  };
};
