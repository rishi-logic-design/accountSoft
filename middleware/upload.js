const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/vendor",
  filename: (req, file, cb) => {
    cb(null, `vendor_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files allowed"), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
});
