const {
  CustomerModel: Customer,
  ProductModel: Product,
  ChallanModel: Challan,
  BillModel: Bill,
  PaymentModel: Payment,
  FirmModel: Firm,
  GstSlabModel: GstSlab,
  ChallanItemModel: ChallanItem,
  BillItemModel: BillItem,
} = require("../../models");

exports.exportVendorData = async (vendorId) => {
  try {
    console.log("Starting export for vendor:", vendorId);

    // 1. Export Firm Data
    const firm = await Firm.findOne({
      where: { vendorId },
      raw: true,
    });

    // 2. Export GST Slabs
    const gstSlabs = await GstSlab.findAll({
      where: { vendorId },
      raw: true,
    });

    // 3. Export Products
    const products = await Product.findAll({
      where: { createdBy: vendorId },
      raw: true,
    });

    // 4. Export Customers
    const customers = await Customer.findAll({
      where: { createdBy: vendorId },
      raw: true,
    });

    // 5. Export Challans with Items
    const challans = await Challan.findAll({
      where: { vendorId },
      include: [
        {
          model: ChallanItem,
          as: "items",
          required: false,
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["mobileNumber"],
        },
      ],
    });

    // Format challans for export
    const formattedChallans = challans.map((challan) => {
      const challanData = challan.toJSON();
      return {
        ...challanData,
        customerMobile: challanData.customer?.mobileNumber,
        customer: undefined,
      };
    });

    // 6. Export Bills with Items
    const bills = await Bill.findAll({
      where: { vendorId },
      include: [
        {
          model: BillItem,
          as: "items",
          required: false,
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["mobileNumber"],
        },
      ],
    });

    // Format bills for export
    const formattedBills = bills.map((bill) => {
      const billData = bill.toJSON();
      return {
        ...billData,
        customerMobile: billData.customer?.mobileNumber,
        customer: undefined,
      };
    });

    // 7. Export Payments
    const payments = await Payment.findAll({
      where: { vendorId },
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["mobileNumber"],
          required: false,
        },
      ],
    });

    // Format payments for export
    const formattedPayments = payments.map((payment) => {
      const paymentData = payment.toJSON();
      return {
        ...paymentData,
        customerMobile: paymentData.customer?.mobileNumber,
        customer: undefined,
      };
    });

    // Compile all data
    const exportData = {
      exportDate: new Date().toISOString(),
      vendorId,
      firm: firm || null,
      gstSlabs: gstSlabs || [],
      products: products || [],
      customers: customers || [],
      challans: formattedChallans || [],
      bills: formattedBills || [],
      payments: formattedPayments || [],
    };

    console.log("Export completed successfully");
    console.log(
      `Exported: ${customers.length} customers, ${products.length} products, ${formattedChallans.length} challans, ${formattedBills.length} bills, ${formattedPayments.length} payments`,
    );

    return exportData;
  } catch (error) {
    console.error("Export error:", error);
    throw new Error("Failed to export data: " + error.message);
  }
};
