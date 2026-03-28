import { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";
import { MongoClient, ObjectId } from "mongodb";

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getStatusByQuantity = (quantity: number) => {
  if (quantity > 20) return "Available";
  if (quantity > 0) return "Stock Low";
  return "Stock Out";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = (session.role || "USER").toUpperCase();
  if (role !== "DEV") {
    return res.status(403).json({ error: "Only DEV can rollback invoices" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const invoiceId = String(req.query.id || "").trim();
  if (!ObjectId.isValid(invoiceId)) {
    return res.status(400).json({ error: "Invalid invoice id" });
  }

  const lokasi = typeof (session as any).lokasi === "string" && (session as any).lokasi.trim()
    ? (session as any).lokasi.trim()
    : "PUSAT";
  const isPusat = lokasi.toUpperCase() === "PUSAT";

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
      const productCollection = db.collection("Product");
      const movementCollection = db.collection("stock_movements");

      const invoice = await invoiceCollection.findOne(
        isPusat ? { _id: new ObjectId(invoiceId) } : { _id: new ObjectId(invoiceId), lokasi }
      );

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (invoice.status === "ROLLED_BACK") {
        return res.status(400).json({ error: "Invoice has already been rolled back" });
      }

      const items = Array.isArray(invoice.items) ? invoice.items : [];
      if (!items.length) {
        return res.status(400).json({ error: "Invoice has no items" });
      }

      const updatedProducts: Array<{ productId: string; stockBefore: number; stockAfter: number; quantity: number; name: string; category: string; supplier: string; unit: string }> = [];

      for (const item of items) {
        const productId = String(item.productId || "").trim();
        if (!ObjectId.isValid(productId)) {
          return res.status(400).json({ error: `Invalid product in invoice: ${productId}` });
        }

        const product = await productCollection.findOne(
          isPusat ? { _id: new ObjectId(productId) } : { _id: new ObjectId(productId), lokasi }
        );

        if (!product) {
          return res.status(404).json({ error: `Product not found for rollback: ${productId}` });
        }

        const rollbackQty = toNumber(item.quantity);
        const stockBefore = toNumber(product.quantity, 0);
        const stockAfter = stockBefore + rollbackQty;

        await productCollection.updateOne(
          isPusat ? { _id: new ObjectId(productId) } : { _id: new ObjectId(productId), lokasi },
          {
            $set: {
              quantity: stockAfter,
              status: getStatusByQuantity(stockAfter),
            },
          }
        );

        updatedProducts.push({
          productId,
          stockBefore,
          stockAfter,
          quantity: rollbackQty,
          name: String(item.name || product.name || "Unknown"),
          category: String(item.category || "Unknown"),
          supplier: String(item.supplier || "Unknown"),
          unit: String(item.unit || product.unit || "pcs"),
        });
      }

      const now = new Date();
      await movementCollection.insertMany(
        updatedProducts.map((product) => ({
          userId: session.id,
          lokasi,
          createdByUserId: session.id,
          createdByName: session.name || "admin",
          createdByEmail: session.email || "",
          productId: product.productId,
          productName: product.name,
          category: product.category,
          supplier: product.supplier,
          unit: product.unit,
          movementType: "IN",
          quantity: product.quantity,
          stockBefore: product.stockBefore,
          stockAfter: product.stockAfter,
          invoiceReference: invoice.invoiceNumber || "",
          notes: `Rollback invoice ${invoice.invoiceNumber || ""}`.trim(),
          createdAt: now,
        }))
      );

      await invoiceCollection.updateOne(
        { _id: new ObjectId(invoiceId) },
        {
          $set: {
            status: "ROLLED_BACK",
            rolledBackAt: now,
            rolledBackByUserId: session.id,
            rolledBackByName: session.name || "admin",
            rolledBackByEmail: session.email || "",
          },
        }
      );

      return res.status(200).json({
        success: true,
        invoiceId,
        status: "ROLLED_BACK",
        rolledBackAt: now.toISOString(),
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to rollback invoice:", error);
    }
    return res.status(500).json({ error: "Failed to rollback invoice" });
  }
}
