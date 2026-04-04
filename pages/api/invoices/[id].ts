import { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";
import { MongoClient, ObjectId } from "mongodb";

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if ((session.role || "").toUpperCase() !== "DEV") {
    return res.status(403).json({ error: "Only DEV can edit invoices" });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const invoiceId = String(req.query.id || "").trim();
  if (!ObjectId.isValid(invoiceId)) {
    return res.status(400).json({ error: "Invalid invoice id" });
  }

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) {
    return res.status(400).json({ error: "Invoice items are required" });
  }

  const normalizedItems = items
    .map((item: any) => {
      const quantity = Math.max(toNumber(item.quantity, 0), 0);
      const price = Math.max(toNumber(item.price, 0), 0);
      return {
        productId: String(item.productId || ""),
        name: String(item.name || ""),
        sku: String(item.sku || ""),
        supplier: String(item.supplier || ""),
        quantity,
        price,
        lineTotal: quantity * price,
      };
    })
    .filter((item: any) => item.productId && item.quantity > 0);

  if (!normalizedItems.length) {
    return res.status(400).json({ error: "At least one valid item is required" });
  }

  const totalAmount = normalizedItems.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
  const discountType = req.body?.discountType === "percentage" ? "percentage" : "fixed";
  const discountValue = Math.max(toNumber(req.body?.discountValue, 0), 0);
  const discountAmount =
    discountType === "percentage"
      ? Math.min(totalAmount * (discountValue / 100), totalAmount)
      : Math.min(discountValue, totalAmount);

  const taxRate = Math.max(toNumber(req.body?.taxRate, 0), 0);
  const taxableAmount = Math.max(totalAmount - discountAmount, 0);
  const taxAmount = taxableAmount * (taxRate / 100);
  const grandTotal = taxableAmount + taxAmount;
  // Keep payment summary consistent for edited invoices (no manual amount-paid input in edit flow).
  const amountPaid = grandTotal;
  const changeAmount = 0;

  try {
    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
      return res.status(500).json({ error: "DATABASE_URL is not configured" });
    }

    const client = new MongoClient(mongoUri);
    await client.connect();

    try {
      const dbName = new URL(mongoUri).pathname.replace("/", "") || undefined;
      const db = client.db(dbName);
      const invoiceCollection = db.collection("invoices");

      const updateData = {
        customerName: String(req.body?.customerName || "Walk-in Customer"),
        items: normalizedItems,
        discountType,
        discountValue,
        discountAmount,
        taxRate,
        taxAmount,
        totalAmount,
        grandTotal,
        amountPaid,
        changeAmount,
        paymentMethod: String(req.body?.paymentMethod || "Tunai"),
        bankName: String(req.body?.bankName || ""),
        promoCode: String(req.body?.promoCode || ""),
        keterangan: String(req.body?.keterangan || ""),
        signatureName: String(req.body?.signatureName || "Ari Wibowo"),
        updatedAt: new Date(),
        editedByUserId: session.id,
        editedByName: session.name || "DEV",
      };

      const result = await invoiceCollection.findOneAndUpdate(
        { _id: new ObjectId(invoiceId) },
        { $set: updateData },
        { returnDocument: "after" }
      );

      if (!result.value) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      return res.status(200).json({
        id: String(result.value._id),
        ...result.value,
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to edit invoice:", error);
    }
    return res.status(500).json({ error: "Failed to edit invoice" });
  }
}
