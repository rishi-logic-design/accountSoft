const {
  CustomerModel: Customer,
  ProductModel: Product,
  ChallanModel: Challan,
  BillModel: Bill,
  PaymentModel: Payment,
  FirmModel: Firm,
  GstSlabModel: GstSlab,
} = require("../../models");

exports.processImport = async (vendorId, data) => {
  const summary = {
    customers: { inserted: 0, skipped: 0 },
    products: { inserted: 0, skipped: 0 },
    challans: { inserted: 0, skipped: 0 },
    bills: { inserted: 0, skipped: 0 },
    payments: { inserted: 0, skipped: 0 },
  };

  // =====================
  // 1. FIRM (single)
  // =====================
  if (data.firm) {
    await Firm.upsert({
      ...data.firm,
      vendorId,
    });
  }

  // =====================
  // 2. GST SLABS
  // =====================
  if (Array.isArray(data.gstSlabs)) {
    for (const slab of data.gstSlabs) {
      if (!slab.slabName || slab.rate == null) continue;

      await GstSlab.create({
        ...slab,
        vendorId,
      });
    }
  }

  // =====================
  // 3. PRODUCTS
  // =====================
  if (Array.isArray(data.products)) {
    for (const p of data.products) {
      if (!p.name || p.price == null) {
        summary.products.skipped++;
        continue;
      }

      await Product.create({
        ...p,
        createdBy: vendorId,
      });

      summary.products.inserted++;
    }
  }

  // =====================
  // 4. CUSTOMERS
  // =====================
  if (Array.isArray(data.customers)) {
    for (const c of data.customers) {
      if (!c.customerName || !c.mobileNumber) {
        summary.customers.skipped++;
        continue;
      }

      const exists = await Customer.findOne({
        where: { mobileNumber: c.mobileNumber, createdBy: vendorId },
      });

      if (exists) {
        summary.customers.skipped++;
        continue;
      }

      await Customer.create({
        ...c,
        createdBy: vendorId,
      });

      summary.customers.inserted++;
    }
  }

  // =====================
  // 5. CHALLANS
  // =====================
  if (Array.isArray(data.challans)) {
    for (const ch of data.challans) {
      if (!ch.challanNumber || !ch.customerMobile) {
        summary.challans.skipped++;
        continue;
      }

      const customer = await Customer.findOne({
        where: { mobileNumber: ch.customerMobile, createdBy: vendorId },
      });

      if (!customer) {
        summary.challans.skipped++;
        continue;
      }

      await Challan.create({
        ...ch,
        vendorId,
        customerId: customer.id,
      });

      summary.challans.inserted++;
    }
  }

  // =====================
  // 6. BILLS
  // =====================
  if (Array.isArray(data.bills)) {
    for (const b of data.bills) {
      if (!b.billNumber || !b.customerMobile) {
        summary.bills.skipped++;
        continue;
      }

      const customer = await Customer.findOne({
        where: { mobileNumber: b.customerMobile, createdBy: vendorId },
      });

      if (!customer) {
        summary.bills.skipped++;
        continue;
      }

      await Bill.create({
        ...b,
        vendorId,
        customerId: customer.id,
      });

      summary.bills.inserted++;
    }
  }

  // =====================
  // 7. PAYMENTS
  // =====================
  if (Array.isArray(data.payments)) {
    for (const p of data.payments) {
      if (!p.paymentNumber || !p.type || !p.amount || !p.paymentDate) {
        summary.payments.skipped++;
        continue;
      }

      let customerId = null;

      if (p.customerMobile) {
        const customer = await Customer.findOne({
          where: { mobileNumber: p.customerMobile, createdBy: vendorId },
        });
        if (!customer) {
          summary.payments.skipped++;
          continue;
        }
        customerId = customer.id;
      }

      await Payment.create({
        ...p,
        vendorId,
        customerId,
      });

      summary.payments.inserted++;
    }
  }

  return summary;
};
