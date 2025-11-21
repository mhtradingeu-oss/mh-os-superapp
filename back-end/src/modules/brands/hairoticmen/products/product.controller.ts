import { Request, Response } from "express";
import {
  createProduct,
  deleteProductBySlug,
  getProductBySlug,
  listProducts,
  updateProductBySlug,
} from "./product.service";

export const addProduct = async (req: Request, res: Response) => {
  try {
    const { brandSlug } = req.params;
    const { name, description, price, imageUrl, categoryId } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        status: "error",
        message: "name and price are required",
      });
    }

    const product = await createProduct(brandSlug, {
      name,
      description,
      price: Number(price),
      imageUrl,
      categoryId: categoryId || null,
    });

    return res.json({
      status: "success",
      product,
    });
  } catch (error: any) {
    console.error("Product creation error:", error);

    if (error.message === "BRAND_NOT_FOUND") {
      return res
        .status(404)
        .json({ status: "error", message: "Brand not found" });
    }

    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const listBrandProducts = async (req: Request, res: Response) => {
  try {
    const { brandSlug } = req.params;

    const products = await listProducts(brandSlug);

    return res.json({
      status: "success",
      products,
    });
  } catch (error: any) {
    console.error("Product list error:", error);

    if (error.message === "BRAND_NOT_FOUND") {
      return res
        .status(404)
        .json({ status: "error", message: "Brand not found" });
    }

    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const getSingleProduct = async (req: Request, res: Response) => {
  try {
    const { productSlug } = req.params;

    const product = await getProductBySlug(productSlug);

    if (!product) {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    return res.json({
      status: "success",
      product,
    });
  } catch (error) {
    console.error("Get product error:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { productSlug } = req.params;
    const { name, description, price, imageUrl, categoryId } = req.body;

    const product = await updateProductBySlug(productSlug, {
      name,
      description,
      price: price !== undefined ? Number(price) : undefined,
      imageUrl,
      categoryId,
    });

    return res.json({
      status: "success",
      product,
    });
  } catch (error: any) {
    console.error("Update product error:", error);

    if (error.message === "PRODUCT_NOT_FOUND") {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const removeProduct = async (req: Request, res: Response) => {
  try {
    const { productSlug } = req.params;

    await deleteProductBySlug(productSlug);

    return res.json({
      status: "success",
      message: "Product deleted",
    });
  } catch (error: any) {
    console.error("Delete product error:", error);

    if (error.message === "PRODUCT_NOT_FOUND") {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};
