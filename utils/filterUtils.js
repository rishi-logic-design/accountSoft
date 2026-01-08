const { Op } = require("sequelize");

exports.parseFilters = (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;

    // Validate date range if both dates are provided
    if (fromDate && toDate) {
      exports.validateDateRange(fromDate, toDate);
    }

    // Attach parsed filters to request
    req.filters = {
      fromDate,
      toDate,
      search: req.query.search,
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'DESC',
    };

    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.buildDateFilter = (fromDate, toDate, fieldName = "createdAt") => {
  const filter = {};

  if (fromDate && toDate) {
    filter[fieldName] = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  } else if (fromDate) {
    // Only from date provided
    filter[fieldName] = {
      [Op.gte]: new Date(fromDate),
    };
  } else if (toDate) {
    // Only to date provided
    filter[fieldName] = {
      [Op.lte]: new Date(toDate),
    };
  }

  return filter;
};

exports.buildSearchFilter = (searchQuery, fields = []) => {
  if (!searchQuery || !fields.length) return {};

  return {
    [Op.or]: fields.map((field) => ({
      [field]: {
        [Op.like]: `%${searchQuery}%`,
      },
    })),
  };
};

exports.buildStatusFilter = (status, fieldName = "status") => {
  if (!status) return {};

  if (Array.isArray(status)) {
    return {
      [fieldName]: {
        [Op.in]: status,
      },
    };
  }

  return { [fieldName]: status };
};

exports.buildPagination = (page = 1, limit = 10) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const offset = (pageNum - 1) * limitNum;

  return {
    limit: limitNum,
    offset: offset,
    page: pageNum,
  };
};

exports.buildCompleteFilter = (queryParams, options = {}) => {
  const {
    dateField = "createdAt",
    searchFields = [],
    statusField = "status",
    additionalFilters = {},
  } = options;

  const {
    fromDate,
    toDate,
    search,
    status,
    page,
    limit,
    sortBy = dateField,
    sortOrder = "DESC",
  } = queryParams;

  // Build individual filters
  const dateFilter = exports.buildDateFilter(fromDate, toDate, dateField);
  const searchFilter = exports.buildSearchFilter(search, searchFields);
  const statusFilter = exports.buildStatusFilter(status, statusField);
  const pagination = exports.buildPagination(page, limit);

  // Combine all filters
  const whereClause = {
    ...dateFilter,
    ...searchFilter,
    ...statusFilter,
    ...additionalFilters,
  };

  return {
    where: whereClause,
    limit: pagination.limit,
    offset: pagination.offset,
    order: [[sortBy, sortOrder.toUpperCase()]],
    page: pagination.page,
  };
};

exports.buildPaginationMeta = (totalCount, page, limit) => {
  const totalPages = Math.ceil(totalCount / limit);

  return {
    total: totalCount,
    page: page,
    limit: limit,
    totalPages: totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

exports.buildVendorFilter = (vendorId, additionalFilters = {}) => {
  return {
    vendorId,
    ...additionalFilters,
  };
};

exports.buildCustomerFilter = (customerId, additionalFilters = {}) => {
  return {
    customerId,
    ...additionalFilters,
  };
};

exports.validateDateRange = (fromDate, toDate) => {
  if (!fromDate || !toDate) return null;

  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new Error("Invalid date format");
  }

  if (from > to) {
    throw new Error("fromDate cannot be greater than toDate");
  }

  return { from, to };
};
