import { Request, Response } from "express";

// Re-require the controller fresh before each test so the module-level
// `historicOrders` in-memory array doesn't leak state between tests.
let splitOrder: (req: Request, res: Response) => any;
let getOrderHistory: (req: Request, res: Response) => any;

beforeEach(() => {
  jest.resetModules();
  const controller = require("../controllers/order.controller");
  splitOrder = controller.splitOrder;
  getOrderHistory = controller.getOrderHistory;
});

// Builds a mock Express Response with chainable, spy-able status()/json().
const mockResponse = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockRequest = (body: unknown): Request => {
  return { body } as Request;
};

const validBuyPayload = {
  portfolioId: "Aggressive-Growth-01",
  orderType: "BUY",
  totalAmount: 100,
  allocations: [
    { symbol: "AAPL", weight: 0.6 },
    { symbol: "TSLA", weight: 0.4 },
  ],
};

describe("splitOrder controller", () => {
  it("responds with 201 and a correctly shaped order for a valid BUY request", () => {
    const req = mockRequest(validBuyPayload);
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody).toHaveProperty("orderId");
    expect(responseBody).toHaveProperty("executionDate");
    expect(responseBody.orderType).toBe("BUY");
    expect(responseBody.totalAmount).toBe(100);
    expect(responseBody.splits).toHaveLength(2);
    expect(responseBody.splits[0]).toMatchObject({
      symbol: "AAPL",
      amount: 60,
    });
    expect(responseBody.splits[1]).toMatchObject({
      symbol: "TSLA",
      amount: 40,
    });
  });

  it("responds with 201 for a SELL request, treated symmetrically to BUY (documented assumption)", () => {
    const req = mockRequest({ ...validBuyPayload, orderType: "SELL" });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.orderType).toBe("SELL");
    expect(responseBody.splits[0].amount).toBe(60); // same math as BUY
  });

  it("responds with 400 for a negative totalAmount", () => {
    const req = mockRequest({ ...validBuyPayload, totalAmount: -50 });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody).toHaveProperty("error");
  });

  it("responds with 400 for a zero totalAmount", () => {
    const req = mockRequest({ ...validBuyPayload, totalAmount: 0 });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("responds with 400 when allocations is missing", () => {
    const req = mockRequest({ orderType: "BUY", totalAmount: 100 });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("responds with 400 when allocations is an empty array", () => {
    const req = mockRequest({ ...validBuyPayload, allocations: [] });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("responds with 400 for an invalid orderType", () => {
    const req = mockRequest({ ...validBuyPayload, orderType: "HOLD" });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("responds with 400 for duplicate symbols in allocations", () => {
    const req = mockRequest({
      ...validBuyPayload,
      allocations: [
        { symbol: "AAPL", weight: 0.5 },
        { symbol: "AAPL", weight: 0.5 },
      ],
    });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("responds with 400 for a negative weight", () => {
    const req = mockRequest({
      ...validBuyPayload,
      allocations: [{ symbol: "AAPL", weight: -0.5 }],
    });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("responds with 422 when weights are individually valid but don't sum to 1.0", () => {
    // Each weight passes Zod's per-item 0 < weight <= 1 check, so this reaches
    // the service layer, which is what actually rejects it.
    const req = mockRequest({
      ...validBuyPayload,
      allocations: [
        { symbol: "AAPL", weight: 0.5 },
        { symbol: "TSLA", weight: 0.3 },
      ],
    });
    const res = mockResponse();

    splitOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.error).toMatch(/Portfolio weights must sum to 100%/);
  });

  it("uses the fixed $100 price when no marketPrice is supplied", () => {
    const req = mockRequest({
      orderType: "BUY",
      totalAmount: 100,
      allocations: [{ symbol: "AAPL", weight: 1 }],
    });
    const res = mockResponse();

    splitOrder(req, res);

    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.splits[0].executionPrice).toBe(100);
  });

  it("prioritizes a supplied marketPrice over the fixed $100 default", () => {
    const req = mockRequest({
      orderType: "BUY",
      totalAmount: 100,
      allocations: [{ symbol: "AAPL", weight: 1, marketPrice: 250 }],
    });
    const res = mockResponse();

    splitOrder(req, res);

    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.splits[0].executionPrice).toBe(250);
  });
});

describe("getOrderHistory controller", () => {
  it("returns an empty array when no orders have been placed yet", () => {
    const req = mockRequest({});
    const res = mockResponse();

    getOrderHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("returns previously placed orders, in submission order", () => {
    const splitReq1 = mockRequest({
      orderType: "BUY",
      totalAmount: 50,
      allocations: [{ symbol: "AAPL", weight: 1 }],
    });
    const splitReq2 = mockRequest({
      orderType: "SELL",
      totalAmount: 75,
      allocations: [{ symbol: "TSLA", weight: 1 }],
    });

    splitOrder(splitReq1, mockResponse());
    splitOrder(splitReq2, mockResponse());

    const historyRes = mockResponse();
    getOrderHistory(mockRequest({}), historyRes);

    expect(historyRes.status).toHaveBeenCalledWith(200);
    const history = (historyRes.json as jest.Mock).mock.calls[0][0];
    expect(history).toHaveLength(2);
    expect(history[0].orderType).toBe("BUY");
    expect(history[1].orderType).toBe("SELL");
  });
});
