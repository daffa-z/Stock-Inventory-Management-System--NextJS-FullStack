import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { getSessionServer } from "@/utils/auth";
import { MongoClient, ObjectId } from "mongodb";

const prisma = new PrismaClient();
const mongoClient = new MongoClient(process.env.DATABASE_URL || "");

const getProductsCollection = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  await mongoClient.connect();
  const db = mongoClient.db();
  return db.collection("Product");
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toRoundedTwo = (value: number) => Math.round(value * 100) / 100;
const calculateMarginPercent = (buyPrice: number, sellPrice: number) => {
  if (buyPrice <= 0) return 0;
  return toRoundedTwo(((sellPrice - buyPrice) / buyPrice) * 100);
};

const toIsoDate = (value: unknown) => {
  const date = value ? new Date(value as string | number | Date) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const resolveActorName = (actor: any) => {
  const name = typeof actor?.createdByName === "string" ? actor.createdByName.trim() : "";
  if (name) return name;

  const directName = typeof actor?.name === "string" ? actor.name.trim() : "";
  if (directName) return directName;

  return "Unknown User";
};

const findCategoryNameById = async (categoryId?: string) => {
  if (!categoryId) return "Tidak Diketahui";
  try {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    return category?.name || "Tidak Diketahui";
  } catch {
    return "Tidak Diketahui";
  }
};

const findSupplierNameById = async (supplierId?: string) => {
  if (!supplierId) return "Tidak Diketahui";
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    return supplier?.name || "Tidak Diketahui";
  } catch {
    return "Tidak Diketahui";
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { method } = req;
  const userId = session.id;
  const lokasi = typeof (session as any).lokasi === "string" && (session as any).lokasi.trim()
    ? (session as any).lokasi.trim()
     : "PUSAT";
  const isPusat = lokasi.toUpperCase() === "PUSAT";

  switch (method) {
    case "POST":
      try {
        const {
          name,
          sku,
          quantity,
          status,
          categoryId,
          supplierId,
          unit,
          buyPrice,
          sellPrice,
          price,
        } = req.body;

        const collection = await getProductsCollection();
        const existingProduct = await collection.findOne(isPusat ? { sku } : { sku, lokasi });

        if (existingProduct) {
          return res.status(400).json({ error: "SKU must be unique" });
        }

        const normalizedBuyPrice = toNumber(buyPrice ?? price, 0);
        const normalizedSellPrice = toNumber(sellPrice ?? price, 0);
        const hetPrice = toNumber(req.body.hetPrice, normalizedSellPrice);
        const minimumMarginPercent = calculateMarginPercent(normalizedBuyPrice, normalizedSellPrice);

        const createdAt = new Date();

        const productDoc = {
          name,
          sku,
          quantity: toNumber(quantity, 0),
          status,
          userId,
          lokasi,
          categoryId,
          supplierId,
          createdAt,
          unit: unit || "pcs",
          buyPrice: normalizedBuyPrice,
          sellPrice: normalizedSellPrice,
          hetPrice: hetPrice > 0 ? hetPrice : normalizedSellPrice,
          minimumMarginPercent,
          price: normalizedSellPrice,
        };

        const inserted = await collection.insertOne(productDoc);

        const categoryName = await findCategoryNameById(categoryId);
        const supplierName = await findSupplierNameById(supplierId);

        const movementCollection = mongoClient.db().collection("stock_movements");
        const initialQty = toNumber(productDoc.quantity, 0);
        if (initialQty > 0) {
          await movementCollection.insertOne({
            userId,
            lokasi,
            createdByUserId: session.id,
            createdByName: resolveActorName({ createdByName: session.name, name: (session as any).name }),
            createdByUsername: typeof (session as any).username === "string" ? (session as any).username : "",
            createdByEmail: session.email || "",
            productId: inserted.insertedId.toString(),
            productName: productDoc.name,
            category: categoryName,
            supplier: supplierName,
            unit: productDoc.unit || "pcs",
            movementType: "IN",
            quantity: initialQty,
            stockBefore: 0,
            stockAfter: initialQty,
            invoiceReference: "PRODUCT-INITIAL",
            notes: `Initial stock from product creation (${productDoc.sku})`,
            createdAt,
          });
        }

        res.status(201).json({
          id: inserted.insertedId.toString(),
          ...productDoc,
          createdAt: createdAt.toISOString(),
          category: categoryName,
          supplier: supplierName,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to create product" });
      }
      break;

    case "GET":
      try {
        const collection = await getProductsCollection();
        const products = await collection.find(isPusat ? {} : { lokasi }).toArray();

        const transformedProducts = await Promise.all(
          products.map(async (product: any) => {
            const categoryName = await findCategoryNameById(product.categoryId);
            const supplierName = await findSupplierNameById(product.supplierId);

            const buy = toNumber(product.buyPrice, toNumber(product.price, 0));
            const existingSell = toNumber(product.sellPrice, toNumber(product.price, 0));
            const existingMargin = product.minimumMarginPercent;
            const minimumMarginPercent =
              typeof existingMargin === "number"
                ? existingMargin
                : calculateMarginPercent(buy, existingSell);
            const hetPrice = toNumber(product.hetPrice, existingSell);

            if (typeof existingMargin !== "number") {
              await collection.updateOne(
                { _id: product._id },
                {
                  $set: {
                    minimumMarginPercent,
                    sellPrice: existingSell,
                    price: existingSell,
                    hetPrice,
                  },
                }
              );
            }

            return {
              id: product._id.toString(),
              name: product.name,
              sku: product.sku,
              quantity: toNumber(product.quantity, 0),
              status: product.status,
              userId: product.userId,
              categoryId: product.categoryId,
              supplierId: product.supplierId,
              createdAt: toIsoDate(product.createdAt),
              unit: product.unit || "pcs",
              buyPrice: buy,
              sellPrice: existingSell,
              hetPrice,
              minimumMarginPercent,
              price: existingSell,
              category: categoryName,
              supplier: supplierName,
            };
          })
        );

        const safeProducts = transformedProducts.filter((product): product is NonNullable<typeof product> => Boolean(product));

        res.status(200).json(safeProducts);

      } catch (error) {
        res.status(500).json({ error: "Failed to fetch products" });
      }
      break;

    case "PUT":
      try {
        const {
          id,
          name,
          sku,
          quantity,
          status,
          categoryId,
          supplierId,
          unit,
          buyPrice,
          sellPrice,
          price,
        } = req.body;

        const collection = await getProductsCollection();
        const normalizedBuyPrice = toNumber(buyPrice ?? price, 0);
        const normalizedSellPrice = toNumber(sellPrice ?? price, 0);
        const hetPrice = toNumber(req.body.hetPrice, normalizedSellPrice);
        const minimumMarginPercent = calculateMarginPercent(normalizedBuyPrice, normalizedSellPrice);

        const previousProduct: any = await collection.findOne(isPusat ? { _id: new ObjectId(id) } : { _id: new ObjectId(id), lokasi });
        if (!previousProduct) {
          return res.status(404).json({ error: "Product not found" });
        }

        const nextQuantity = toNumber(quantity, 0);

        await collection.updateOne(
          isPusat ? { _id: new ObjectId(id) } : { _id: new ObjectId(id), lokasi },
          {
            $set: {
              name,
              sku,
              quantity: nextQuantity,
              status,
              categoryId,
              supplierId,
              unit: unit || "pcs",
              buyPrice: normalizedBuyPrice,
              sellPrice: normalizedSellPrice,
              hetPrice: hetPrice > 0 ? hetPrice : normalizedSellPrice,
              minimumMarginPercent,
              price: normalizedSellPrice,
            },
          }
        );

        const updatedProduct = await collection.findOne(isPusat ? { _id: new ObjectId(id) } : { _id: new ObjectId(id), lokasi });
        const categoryName = await findCategoryNameById(categoryId);
        const supplierName = await findSupplierNameById(supplierId);

        if (!updatedProduct) {
          return res.status(404).json({ error: "Product not found" });
        }

        const previousQty = toNumber(previousProduct.quantity, 0);
        const qtyDelta = nextQuantity - previousQty;
        if (qtyDelta !== 0) {
          const movementCollection = mongoClient.db().collection("stock_movements");
          await movementCollection.insertOne({
            userId,
            lokasi,
            createdByUserId: session.id,
            createdByName: resolveActorName({ createdByName: session.name, name: (session as any).name }),
            createdByUsername: typeof (session as any).username === "string" ? (session as any).username : "",
            createdByEmail: session.email || "",
            productId: updatedProduct._id.toString(),
            productName: updatedProduct.name,
            category: categoryName,
            supplier: supplierName,
            unit: updatedProduct.unit || "pcs",
            movementType: qtyDelta > 0 ? "IN" : "OUT",
            quantity: Math.abs(qtyDelta),
            stockBefore: previousQty,
            stockAfter: nextQuantity,
            invoiceReference: "PRODUCT-ADJUSTMENT",
            notes: `Stock adjusted from product update (${updatedProduct.sku})`,
            createdAt: new Date(),
          });
        }

        res.status(200).json({
          id: updatedProduct._id.toString(),
          name: updatedProduct.name,
          sku: updatedProduct.sku,
          quantity: toNumber(updatedProduct.quantity, 0),
          status: updatedProduct.status,
          userId: updatedProduct.userId,
          categoryId: updatedProduct.categoryId,
          supplierId: updatedProduct.supplierId,
          createdAt: toIsoDate(updatedProduct.createdAt),
          unit: updatedProduct.unit || "pcs",
          buyPrice: toNumber(updatedProduct.buyPrice, toNumber(updatedProduct.price, 0)),
          sellPrice: toNumber(updatedProduct.sellPrice, toNumber(updatedProduct.price, 0)),
          hetPrice: toNumber(updatedProduct.hetPrice, toNumber(updatedProduct.sellPrice, toNumber(updatedProduct.price, 0))),
          minimumMarginPercent: calculateMarginPercent(
            toNumber(updatedProduct.buyPrice, toNumber(updatedProduct.price, 0)),
            toNumber(updatedProduct.sellPrice, toNumber(updatedProduct.price, 0))
          ),
          price: toNumber(updatedProduct.sellPrice, toNumber(updatedProduct.price, 0)),
          category: categoryName,
          supplier: supplierName,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to update product" });
      }
      break;

    case "DELETE":
      try {
        const { id } = req.body;
        const collection = await getProductsCollection();
        await collection.deleteOne(isPusat ? { _id: new ObjectId(id) } : { _id: new ObjectId(id), lokasi });

        res.status(204).end();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete product" });
      }
      break;

    default:
      res.setHeader("Allow", ["POST", "GET", "PUT", "DELETE"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
