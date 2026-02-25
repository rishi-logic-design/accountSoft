const {
  CustomerModel,
  BillModel,
  PaymentModel,
  CreditNoteModel,
  VendorVendorModel,
  PurchaseModel,
  PurchasePaymentModel,
  SalesDebitNoteModel,
} = require("../../models");
const { Op } = require("sequelize");

function toNum(v) {
  return parseFloat(v || 0);
}

exports.getCustomerList = async (
  vendorId,
  { search, page = 1, size = 25 } = {},
) => {
  const whereCustomer = { createdBy: vendorId };

  if (search) {
    whereCustomer[Op.or] = [
      { customerName: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
      { mobileNumber: { [Op.like]: `%${search}%` } },
    ];
  }

  const { rows: customers, count } = await CustomerModel.findAndCountAll({
    where: whereCustomer,
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["customerName", "ASC"]],
  });

  // Load balances for each customer
  const results = await Promise.all(
    customers.map(async (customer) => {
      const [totalBills, totalPayments, totalCreditNotes] = await Promise.all([
        BillModel.sum("totalAmount", {
          where: { vendorId, customerId: customer.id },
        }).then(toNum),
        PaymentModel.sum("amount", {
          where: {
            vendorId,
            customerId: customer.id,
            type: "credit",
            status: "completed",
          },
        }).then(toNum),
        CreditNoteModel.sum("totalAmount", {
          where: { vendorId, customerId: customer.id },
        }).then(toNum),
      ]);

      const balance = +(totalBills - totalPayments - totalCreditNotes).toFixed(
        2,
      );

      // Extract city from homeAddress JSON
      let city = null;
      if (customer.homeAddress) {
        try {
          const addr =
            typeof customer.homeAddress === "string"
              ? JSON.parse(customer.homeAddress)
              : customer.homeAddress;
          city = addr.areaCity || addr.city || null;
        } catch (_) {}
      }

      return {
        id: customer.id,
        customerName: customer.customerName,
        businessName: customer.businessName,
        mobileNumber: customer.mobileNumber,
        city,
        gstNumber: customer.gstNumber,
        gstType: customer.gstNumber ? "Registered" : "Unregistered",
        balance,
      };
    }),
  );

  return {
    total: count,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(count / Number(size)),
    rows: results,
  };
};

exports.getCustomerLedger = async (
  vendorId,
  customerId,
  { fromDate, toDate, search } = {},
) => {
  const customer = await CustomerModel.findOne({
    where: { id: customerId, createdBy: vendorId },
  });
  if (!customer) throw new Error("Customer not found");

  // Build date filters
  const billDateFilter = {};
  const paymentDateFilter = {};
  const creditNoteDateFilter = {};

  if (fromDate) {
    billDateFilter[Op.gte] = new Date(fromDate);
    paymentDateFilter[Op.gte] = new Date(fromDate);
    creditNoteDateFilter[Op.gte] = new Date(fromDate);
  }
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    billDateFilter[Op.lte] = end;
    paymentDateFilter[Op.lte] = end;
    creditNoteDateFilter[Op.lte] = end;
  }

  // ── Opening Balance = everything BEFORE fromDate ──────────────────────────
  let openingBalance = 0;
  if (fromDate) {
    const beforeDate = new Date(fromDate);
    const [prevBills, prevPayments, prevCreditNotes] = await Promise.all([
      BillModel.sum("totalAmount", {
        where: { vendorId, customerId, billDate: { [Op.lt]: beforeDate } },
      }).then(toNum),
      PaymentModel.sum("amount", {
        where: {
          vendorId,
          customerId,
          type: "credit",
          status: "completed",
          paymentDate: { [Op.lt]: beforeDate },
        },
      }).then(toNum),
      CreditNoteModel.sum("totalAmount", {
        where: { vendorId, customerId, noteDate: { [Op.lt]: beforeDate } },
      }).then(toNum),
    ]);
    openingBalance = +(prevBills - prevPayments - prevCreditNotes).toFixed(2);
  }

  // ── Fetch entries in the date range ──────────────────────────────────────
  const [bills, payments, creditNotes] = await Promise.all([
    BillModel.findAll({
      where: {
        vendorId,
        customerId,
        ...(Object.keys(billDateFilter).length
          ? { billDate: billDateFilter }
          : {}),
      },
      order: [["billDate", "ASC"]],
    }),
    PaymentModel.findAll({
      where: {
        vendorId,
        customerId,
        type: "credit",
        status: "completed",
        ...(Object.keys(paymentDateFilter).length
          ? { paymentDate: paymentDateFilter }
          : {}),
      },
      order: [["paymentDate", "ASC"]],
    }),
    CreditNoteModel.findAll({
      where: {
        vendorId,
        customerId,
        ...(Object.keys(creditNoteDateFilter).length
          ? { noteDate: creditNoteDateFilter }
          : {}),
      },
      order: [["noteDate", "ASC"]],
    }),
  ]);

  // ── Merge and sort entries ────────────────────────────────────────────────
  const entries = [];

  bills.forEach((b) => {
    entries.push({
      voucherDate: b.billDate,
      voucherNo: b.billNumber,
      particulars: "Sales",
      voucherType: "Invoice",
      debit: toNum(b.totalAmount),
      credit: 0,
      refId: b.id,
      refType: "bill",
    });
  });

  payments.forEach((p) => {
    entries.push({
      voucherDate: p.paymentDate,
      voucherNo: p.paymentNumber,
      particulars: "Receipt",
      voucherType: "Payment Receipt",
      debit: 0,
      credit: toNum(p.amount),
      refId: p.id,
      refType: "payment",
    });
  });

  creditNotes.forEach((cn) => {
    entries.push({
      voucherDate: cn.noteDate,
      voucherNo: cn.noteNumber,
      particulars: "Credit Note",
      voucherType: "Credit Note",
      debit: 0,
      credit: toNum(cn.totalAmount),
      refId: cn.id,
      refType: "credit_note",
    });
  });

  // Sort by date
  entries.sort((a, b) => new Date(a.voucherDate) - new Date(b.voucherDate));

  // Apply search filter if provided
  const filteredEntries = search
    ? entries.filter(
        (e) =>
          e.voucherNo?.toLowerCase().includes(search.toLowerCase()) ||
          e.particulars?.toLowerCase().includes(search.toLowerCase()) ||
          e.voucherType?.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  // Calculate closing balance
  const totalDebit = filteredEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = filteredEntries.reduce((s, e) => s + e.credit, 0);
  const closingBalance = +(openingBalance + totalDebit - totalCredit).toFixed(
    2,
  );

  return {
    customer: {
      id: customer.id,
      customerName: customer.customerName,
      businessName: customer.businessName,
      mobileNumber: customer.mobileNumber,
      gstNumber: customer.gstNumber,
    },
    fromDate: fromDate || null,
    toDate: toDate || null,
    openingBalance,
    entries: filteredEntries,
    totalDebit: +totalDebit.toFixed(2),
    totalCredit: +totalCredit.toFixed(2),
    closingBalance,
  };
};

exports.getVendorList = async (
  vendorId,
  { search, page = 1, size = 25 } = {},
) => {
  const whereVendor = { createdBy: vendorId };

  if (search) {
    whereVendor[Op.or] = [
      { vendorName: { [Op.like]: `%${search}%` } },
      { mobile: { [Op.like]: `%${search}%` } },
    ];
  }

  const { rows: vendors, count } = await VendorVendorModel.findAndCountAll({
    where: whereVendor,
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["vendorName", "ASC"]],
  });

  const results = await Promise.all(
    vendors.map(async (vendor) => {
      const [totalPurchases, totalPayments, totalDebitNotes] =
        await Promise.all([
          PurchaseModel.sum("totalAmount", {
            where: { vendorId, sellerId: vendor.id },
          }).then(toNum),
          PurchasePaymentModel.sum("amount", {
            where: { vendorId, sellerId: vendor.id, status: "completed" },
          }).then(toNum),
          SalesDebitNoteModel.sum("finalAmount", { where: { vendorId } }).then(
            toNum,
          ),
        ]);

      const balance = +(
        totalPurchases -
        totalPayments -
        totalDebitNotes
      ).toFixed(2);

      return {
        id: vendor.id,
        vendorName: vendor.vendorName,
        mobile: vendor.mobile,
        city: vendor.city,
        gst: vendor.gst,
        gstType: vendor.gst ? "Registered" : "N/A",
        balance,
        balanceType:
          balance > 0 ? "Payable" : balance < 0 ? "Receivable" : "Settled",
      };
    }),
  );

  return {
    total: count,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(count / Number(size)),
    rows: results,
  };
};

exports.getVendorLedger = async (
  vendorId,
  sellerId,
  { fromDate, toDate, search } = {},
) => {
  const seller = await VendorVendorModel.findOne({
    where: { id: sellerId, createdBy: vendorId },
  });
  if (!seller) throw new Error("Vendor not found");

  // Build date filters
  const purchaseDateFilter = {};
  const paymentDateFilter = {};
  const debitNoteDateFilter = {};

  if (fromDate) {
    purchaseDateFilter[Op.gte] = new Date(fromDate);
    paymentDateFilter[Op.gte] = new Date(fromDate);
    debitNoteDateFilter[Op.gte] = new Date(fromDate);
  }
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    purchaseDateFilter[Op.lte] = end;
    paymentDateFilter[Op.lte] = end;
    debitNoteDateFilter[Op.lte] = end;
  }

  // ── Opening Balance ───────────────────────────────────────────────────────
  let openingBalance = 0;
  if (fromDate) {
    const beforeDate = new Date(fromDate);
    const [prevPurchases, prevPayments, prevDebitNotes] = await Promise.all([
      PurchaseModel.sum("totalAmount", {
        where: { vendorId, sellerId, purchaseDate: { [Op.lt]: beforeDate } },
      }).then(toNum),
      PurchasePaymentModel.sum("amount", {
        where: {
          vendorId,
          sellerId,
          status: "completed",
          paymentDate: { [Op.lt]: beforeDate },
        },
      }).then(toNum),
      SalesDebitNoteModel.sum("finalAmount", {
        where: { vendorId, noteDate: { [Op.lt]: beforeDate } },
      }).then(toNum),
    ]);
    openingBalance = +(prevPurchases - prevPayments - prevDebitNotes).toFixed(
      2,
    );
  }

  // ── Fetch entries ─────────────────────────────────────────────────────────
  const [purchases, purchasePayments, salesDebitNotes] = await Promise.all([
    PurchaseModel.findAll({
      where: {
        vendorId,
        sellerId,
        ...(Object.keys(purchaseDateFilter).length
          ? { purchaseDate: purchaseDateFilter }
          : {}),
      },
      order: [["purchaseDate", "ASC"]],
    }),
    PurchasePaymentModel.findAll({
      where: {
        vendorId,
        sellerId,
        status: "completed",
        ...(Object.keys(paymentDateFilter).length
          ? { paymentDate: paymentDateFilter }
          : {}),
      },
      order: [["paymentDate", "ASC"]],
    }),
    SalesDebitNoteModel.findAll({
      where: {
        vendorId,
        ...(Object.keys(debitNoteDateFilter).length
          ? { noteDate: debitNoteDateFilter }
          : {}),
      },
      order: [["noteDate", "ASC"]],
    }),
  ]);

  // ── Merge entries ─────────────────────────────────────────────────────────
  const entries = [];

  purchases.forEach((p) => {
    entries.push({
      voucherDate: p.purchaseDate,
      voucherNo: p.purchaseNumber,
      particulars: "Purchase",
      voucherType: "Purchase",
      debit: 0,
      credit: toNum(p.totalAmount),
      refId: p.id,
      refType: "purchase",
    });
  });

  purchasePayments.forEach((pp) => {
    entries.push({
      voucherDate: pp.paymentDate,
      voucherNo: pp.receiptNumber,
      particulars: "Payment",
      voucherType: "Vendor Payment",
      debit: toNum(pp.amount),
      credit: 0,
      refId: pp.id,
      refType: "purchase_payment",
    });
  });

  salesDebitNotes.forEach((sdn) => {
    entries.push({
      voucherDate: sdn.noteDate,
      voucherNo: sdn.noteNumber,
      particulars: "Debit Note",
      voucherType: "Debit Note",
      debit: toNum(sdn.finalAmount),
      credit: 0,
      refId: sdn.id,
      refType: "sales_debit_note",
    });
  });

  entries.sort((a, b) => new Date(a.voucherDate) - new Date(b.voucherDate));

  const filteredEntries = search
    ? entries.filter(
        (e) =>
          e.voucherNo?.toLowerCase().includes(search.toLowerCase()) ||
          e.particulars?.toLowerCase().includes(search.toLowerCase()) ||
          e.voucherType?.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  const totalDebit = filteredEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = filteredEntries.reduce((s, e) => s + e.credit, 0);
  const closingBalance = +(openingBalance + totalCredit - totalDebit).toFixed(
    2,
  );

  return {
    seller: {
      id: seller.id,
      vendorName: seller.vendorName,
      mobile: seller.mobile,
      city: seller.city,
      gst: seller.gst,
    },
    fromDate: fromDate || null,
    toDate: toDate || null,
    openingBalance,
    entries: filteredEntries,
    totalDebit: +totalDebit.toFixed(2),
    totalCredit: +totalCredit.toFixed(2),
    closingBalance,
    closingBalanceType:
      closingBalance > 0
        ? "Payable"
        : closingBalance < 0
          ? "Receivable"
          : "Settled",
  };
};
