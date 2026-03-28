
"use client";

//import React, { useEffect } from "react";
import { Product } from "@/app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useProductStore } from "@/app/useProductStore";
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { FiFileText, FiGrid } from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import * as XLSX from 'xlsx';
import { CategoryDropDown } from "./AppTable/dropdowns/CategoryDropDown";
import { StatusDropDown } from "./AppTable/dropdowns/StatusDropDown";
import { SuppliersDropDown } from "./AppTable/dropdowns/SupplierDropDown";
import AddCategoryDialog from "./AppTable/ProductDialog/AddCategoryDialog";
import AddProductDialog from "./AppTable/ProductDialog/AddProductDialog";
import PaginationSelection, {
  PaginationType,
} from "./Products/PaginationSelection";

type FiltersAndActionsProps = {
  allProducts: Product[];
  selectedCategory: string[];
  setSelectedCategory: React.Dispatch<React.SetStateAction<string[]>>;
  selectedStatuses: string[];
  setSelectedStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSuppliers: string[];
  setSelectedSuppliers: React.Dispatch<React.SetStateAction<string[]>>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  pagination: PaginationType;
  setPagination: (
    updater: PaginationType | ((old: PaginationType) => PaginationType)
  ) => void;
  userId: string;
};

export default function FiltersAndActions({
  allProducts,
  selectedCategory,
  setSelectedCategory,
  selectedStatuses,
  setSelectedStatuses,
  selectedSuppliers,
  setSelectedSuppliers,
  searchTerm,
  setSearchTerm,
  pagination,
  setPagination,
  userId,
}: FiltersAndActionsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const {
    categories,
    suppliers,
    loadCategories,
    loadSuppliers,
    addProduct,
    loadProducts,
  } = useProductStore();

  useEffect(() => {
    loadCategories();
    loadSuppliers();
  }, [loadCategories, loadSuppliers]);

  const categoryByName = useMemo(
    () =>
      new Map(
        categories.map((category) => [category.name.trim().toLowerCase(), category.id])
      ),
    [categories]
  );

  const supplierByName = useMemo(
    () =>
      new Map(
        suppliers.map((supplier) => [supplier.name.trim().toLowerCase(), supplier.id])
      ),
    [suppliers]
  );

  // Filter products based on current filters
  const getFilteredProducts = () => {
    return allProducts.filter((product) => {
      const searchMatch = !searchTerm ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatch =
        selectedCategory.length === 0 ||
        selectedCategory.includes(product.categoryId ?? "");
      const supplierMatch =
        selectedSuppliers.length === 0 ||
        selectedSuppliers.includes(product.supplierId ?? "");
      const statusMatch =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(product.status ?? "");
      return searchMatch && categoryMatch && supplierMatch && statusMatch;
    });
  };

  const exportToCSV = () => {
    try {
      const filteredProducts = getFilteredProducts();

      if (filteredProducts.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There are no products to export with the current filters.",
          variant: "destructive",
        });
        return;
      }

      const csvData = filteredProducts.map(product => ({
        'Tanggal Input': new Date(product.createdAt).toLocaleDateString('id-ID'),
        'Nama Barang': product.name,
        'SKU': product.sku,
        'Stok': product.quantity,
        'Satuan': product.unit || 'pcs',
        'Harga Beli': product.buyPrice ?? product.price,
        'Harga Jual': product.sellPrice ?? product.price,
        'Status': product.status,
        'Kategori': product.category || 'Tidak Diketahui',
        'Supplier': product.supplier || 'Tidak Diketahui',
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `stockly-products-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "CSV Export Successful!",
        description: `${filteredProducts.length} products exported to CSV file.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export products to CSV. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = () => {
    try {
      const filteredProducts = getFilteredProducts();

      if (filteredProducts.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There are no products to export with the current filters.",
          variant: "destructive",
        });
        return;
      }

      const excelData = filteredProducts.map(product => ({
        'Tanggal Input': new Date(product.createdAt).toLocaleDateString('id-ID'),
        'Nama Barang': product.name,
        'SKU': product.sku,
        'Stok': product.quantity,
        'Satuan': product.unit || 'pcs',
        'Harga Beli': product.buyPrice ?? product.price,
        'Harga Jual': product.sellPrice ?? product.price,
        'Status': product.status,
        'Kategori': product.category || 'Tidak Diketahui',
        'Supplier': product.supplier || 'Tidak Diketahui',
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');

      // Auto-size columns
      const colWidths = [
        { wch: 14 }, // Tanggal Input
        { wch: 20 }, // Nama Barang
        { wch: 15 }, // SKU
        { wch: 10 }, // Stok
        { wch: 10 }, // Satuan
        { wch: 14 }, // Harga Beli
        { wch: 14 }, // Harga Jual
        { wch: 12 }, // Status
        { wch: 15 }, // Kategori
        { wch: 15 }, // Supplier
      ];
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `stockly-products-${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: "Excel Export Successful!",
        description: `${filteredProducts.length} products exported to Excel file.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export products to Excel. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadImportTemplate = () => {
    const templateRows = [
      {
        "Nama Barang": "Contoh Produk",
        SKU: "SKU-001",
        Stok: 100,
        Satuan: "pcs",
        "Harga Beli": 5000,
        "Harga Jual": 6500,
        Status: "Draft",
        Kategori: categories[0]?.name || "Isi dengan nama kategori",
        Supplier: suppliers[0]?.name || "Isi dengan nama supplier",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws["!cols"] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Produk");
    XLSX.writeFile(wb, "stockly-product-import-template.xlsx");
  };

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsImporting(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      if (rows.length === 0) {
        toast({
          title: "Import Failed",
          description: "File Excel kosong. Gunakan template agar format sesuai.",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      const failedRows: string[] = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNumber = index + 2;
        const name = String(row["Nama Barang"] || "").trim();
        const sku = String(row["SKU"] || "").trim();
        const categoryName = String(row["Kategori"] || "").trim();
        const supplierName = String(row["Supplier"] || "").trim();
        const status = String(row["Status"] || "Draft").trim() || "Draft";

        if (!name || !sku) {
          failedRows.push(`Baris ${rowNumber}: Nama Barang/SKU wajib diisi`);
          continue;
        }

        const categoryId = categoryByName.get(categoryName.toLowerCase());
        const supplierId = supplierByName.get(supplierName.toLowerCase());

        if (!categoryId || !supplierId) {
          failedRows.push(
            `Baris ${rowNumber}: Kategori/Supplier tidak ditemukan. Sesuaikan dengan data di aplikasi`
          );
          continue;
        }

        const quantity = Number(row["Stok"] ?? 0);
        const buyPrice = Number(row["Harga Beli"] ?? 0);
        const sellPrice = Number(row["Harga Jual"] ?? buyPrice);
        const unit = String(row["Satuan"] || "pcs").trim() || "pcs";

        const productPayload = {
          id: "",
          createdAt: new Date(),
          userId,
          name,
          sku,
          quantity: Number.isFinite(quantity) ? quantity : 0,
          status,
          categoryId,
          supplierId,
          unit,
          buyPrice: Number.isFinite(buyPrice) ? buyPrice : 0,
          sellPrice: Number.isFinite(sellPrice) ? sellPrice : 0,
          price: Number.isFinite(sellPrice) ? sellPrice : 0,
        } as Product;

        const result = await addProduct(productPayload);
        if (result.success) {
          successCount += 1;
        } else {
          failedRows.push(`Baris ${rowNumber}: gagal menambahkan produk`);
        }
      }

      await loadProducts();

      if (successCount > 0) {
        toast({
          title: "Import selesai",
          description: `${successCount} produk berhasil diimpor.`,
        });
      }

      if (failedRows.length > 0) {
        toast({
          title: "Sebagian data gagal diimpor",
          description: failedRows.slice(0, 2).join(" | "),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Gagal membaca file Excel. Pastikan format sesuai template.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const filteredProducts = getFilteredProducts();

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Search Bar */}
      <div className="flex justify-center">
        <div className="relative w-full max-w-xl">
          <Input
            placeholder="Search by Name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pr-10 w-full"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <IoClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter Area */}
      <FilterArea
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedCategories={selectedCategory}
        setSelectedCategories={setSelectedCategory}
        selectedSuppliers={selectedSuppliers}
        setSelectedSuppliers={setSelectedSuppliers}
      />

      {/* Export Section */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 bg-muted p-2 rounded-lg">
          <span className="text-sm font-medium text-muted-foreground">
            Export {filteredProducts.length} products:
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="flex items-center gap-2"
          >
            <FiFileText className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            className="flex items-center gap-2"
          >
            <FiGrid className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadImportTemplate}
            className="flex items-center gap-2"
          >
            Template
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleImportButtonClick}
            disabled={isImporting}
            className="flex items-center gap-2"
          >
            {isImporting ? "Importing..." : "Import Excel"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />
        </div>
      </div>

      {/* Large Screen Layout */}
      <div className="hidden lg:flex justify-between items-center gap-4">
        {/* Add Buttons */}
        <div className="flex gap-4">
          <AddProductDialog allProducts={allProducts} userId={userId} />
          <AddCategoryDialog />
        </div>

        {/* Pagination Selection */}
        <div className="flex justify-center">
          <PaginationSelection
            pagination={pagination}
            setPagination={setPagination}
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-4">
          <CategoryDropDown
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
          />
          <StatusDropDown
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
          />
          <SuppliersDropDown
            selectedSuppliers={selectedSuppliers}
            setSelectedSuppliers={setSelectedSuppliers}
          />
        </div>
      </div>

      {/* Medium and Small Screen Layout */}
      <div className="flex flex-col lg:hidden gap-4">
        {/* Add Buttons */}
        <div className="flex flex-col gap-4">
          <AddProductDialog allProducts={allProducts} userId={userId} />
          <AddCategoryDialog />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-col gap-4">
          <CategoryDropDown
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
          />
          <StatusDropDown
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
          />
          <SuppliersDropDown
            selectedSuppliers={selectedSuppliers}
            setSelectedSuppliers={setSelectedSuppliers}
          />
        </div>
      </div>
    </div>
  );
}

// Add the FilterArea component here
function FilterArea({
  selectedStatuses,
  setSelectedStatuses,
  selectedCategories,
  setSelectedCategories,
  selectedSuppliers,
  setSelectedSuppliers,
}: {
  selectedStatuses: string[];
  setSelectedStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCategories: string[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSuppliers: string[];
  setSelectedSuppliers: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 poppins">
      {/* Status Filter */}
      {selectedStatuses.length > 0 && (
        <div className="border-dashed border rounded-sm p-1 flex gap-2 items-center px-2 text-sm">
          <span className="text-gray-600">Status</span>
          <Separator orientation="vertical" />
          <div className="flex gap-2 items-center">
            {selectedStatuses.length < 3 ? (
              selectedStatuses.map((status, index) => (
                <Badge key={index} variant={"secondary"}>
                  {status}
                </Badge>
              ))
            ) : (
              <Badge variant={"secondary"}>3 Selected</Badge>
            )}
          </div>
        </div>
      )}

      {/* Category Filter */}
      {selectedCategories.length > 0 && (
        <div className="border-dashed border rounded-sm p-1 flex gap-2 items-center px-2 text-sm">
          <span className="text-gray-600">Category</span>
          <Separator orientation="vertical" />
          <div className="flex gap-2 items-center">
            {selectedCategories.length < 3 ? (
              selectedCategories.map((category, index) => (
                <Badge key={index} variant={"secondary"}>
                  {category}
                </Badge>
              ))
            ) : (
              <Badge variant={"secondary"}>3 Selected</Badge>
            )}
          </div>
        </div>
      )}

      {/* Supplier Filter */}
      {selectedSuppliers.length > 0 && (
        <div className="border-dashed border rounded-sm p-1 flex gap-2 items-center px-2 text-sm">
          <span className="text-gray-600">Supplier</span>
          <Separator orientation="vertical" />
          <div className="flex gap-2 items-center">
            {selectedSuppliers.length < 3 ? (
              selectedSuppliers.map((supplier, index) => (
                <Badge key={index} variant={"secondary"}>
                  {supplier}
                </Badge>
              ))
            ) : (
              <Badge variant={"secondary"}>3 Selected</Badge>
            )}
          </div>
        </div>
      )}

      {/* Reset Filters Button */}
      {(selectedStatuses.length > 0 ||
        selectedCategories.length > 0 ||
        selectedSuppliers.length > 0) && (
          <Button
            onClick={() => {
              setSelectedStatuses([]);
              setSelectedCategories([]);
              setSelectedSuppliers([]);
            }}
            variant={"ghost"}
            className="p-1 px-2"
          >
            <span>Reset</span>
            <IoClose />
          </Button>
        )}
    </div>
  );
}
