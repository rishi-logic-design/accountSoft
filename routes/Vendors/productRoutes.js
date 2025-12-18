const express = require("express");
const router = express.Router();
const productCtrl = require("../controllers/productController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

// All protected (vendor/admin)
router.use(auth);
router.use(role(["vendor", "admin"]));

// Category & Size management (admin or vendor can use)
router.post("/categories", productCtrl.createCategory);
router.get("/categories", productCtrl.listCategories);

router.post("/sizes", productCtrl.createSize);
router.get("/sizes", productCtrl.listSizes);

// Products
router.post("/", productCtrl.createProduct);
router.get("/", productCtrl.listProducts);
router.get("/:id", productCtrl.getProductDetail);
router.put("/:id", productCtrl.updateProduct);
router.delete("/:id", productCtrl.deleteProduct);

// Stock management
router.post("/stock/change", productCtrl.changeStock);

module.exports = router;
