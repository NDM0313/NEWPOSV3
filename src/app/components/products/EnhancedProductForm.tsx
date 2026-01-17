import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  X,
  Upload,
  Plus,
  Trash2,
  RefreshCcw,
  Barcode,
  Package,
  DollarSign,
  Clock,
  Shield,
  ChevronDown,
} from "lucide-react";
import { clsx } from "clsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

// Define the validation schema
const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcodeType: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  unit: z.string().optional(),

  // Sales Pricing (Always Sellable in Retail Mode)
  purchasePrice: z.coerce.number().min(0).optional(),
  margin: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce
    .number()
    .min(0.01, "Selling price is required"),
  taxType: z.string().optional(),

  // Rental Pricing (Optional)
  rentalPrice: z.coerce.number().min(0).optional(),
  securityDeposit: z.coerce.number().min(0).optional(),
  rentalDuration: z.coerce.number().min(1).optional(),

  // Inventory
  stockManagement: z.boolean().default(true),
  initialStock: z.coerce.number().min(0).optional(),
  alertQty: z.coerce.number().min(0).optional(),

  // Details
  description: z.string().optional(),
  notes: z.string().optional(),

  // Supplier
  supplier: z.string().optional(),
  supplierCode: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface EnhancedProductFormProps {
  onCancel: () => void;
  onSave: (product?: any) => void;
  onSaveAndAdd?: (product: any) => void;
}

export const EnhancedProductForm = ({
  onCancel,
  onSave,
  onSaveAndAdd,
}: EnhancedProductFormProps) => {
  const [images, setImages] = useState<File[]>([]);
  const [isRentalOptionsOpen, setIsRentalOptionsOpen] =
    useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      stockManagement: true,
      purchasePrice: 0,
      margin: 30,
      sellingPrice: 0,
      rentalPrice: 0,
      securityDeposit: 0,
      rentalDuration: 3, // Default 3 days
    },
  });

  const stockManagement = watch("stockManagement");
  const purchasePrice = watch("purchasePrice");
  const margin = watch("margin");

  // Auto-calculate selling price when purchase price or margin changes
  useEffect(() => {
    if (purchasePrice && margin) {
      const sp = purchasePrice + (purchasePrice * margin) / 100;
      setValue("sellingPrice", parseFloat(sp.toFixed(2)));
    }
  }, [purchasePrice, margin, setValue]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setImages((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } =
    useDropzone({ onDrop });

  const generateSKU = () => {
    const newSku =
      "PRD-" +
      Math.random().toString(36).substring(2, 9).toUpperCase();
    setValue("sku", newSku);
  };

  const onSubmit = (
    data: ProductFormValues,
    action: "save" | "saveAndAdd",
  ) => {
    const payload = {
      ...data,
      id: Date.now(),
      isSellable: true, // Always true for retail
      isRentable: (data.rentalPrice || 0) > 0, // Auto-detect rentability
      // Add images handling here if needed
    };

    if (action === "saveAndAdd" && onSaveAndAdd) {
      onSaveAndAdd(payload);
    } else {
      onSave(payload);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold">Add New Product</h2>
          <p className="text-sm text-gray-400">
            Complete product details for inventory
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-800 rounded-full"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Section 1: Basic Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3 flex items-center gap-2">
            <Package size={20} />
            Product Identity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name" className="text-gray-200">
                Product Name *
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g. Cotton Premium Shirt"
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="sku" className="text-gray-200">
                SKU / Code *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="sku"
                  {...register("sku")}
                  placeholder="AUTO-GENERATED"
                  className="bg-gray-800 border-gray-700 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={generateSKU}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <RefreshCcw size={16} />
                </button>
              </div>
              {errors.sku && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.sku.message}
                </p>
              )}
            </div>

            <div>
              <Label
                htmlFor="barcode-type"
                className="text-gray-200"
              >
                Barcode Type
              </Label>
              <Controller
                control={control}
                name="barcodeType"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                      <SelectItem value="ean13">
                        EAN-13
                      </SelectItem>
                      <SelectItem value="ean8">
                        EAN-8
                      </SelectItem>
                      <SelectItem value="upc">UPC-A</SelectItem>
                      <SelectItem value="code128">
                        Code 128
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Classification */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-l-4 border-purple-500 pl-3">
            Classification
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-200">Brand</Label>
              <Controller
                control={control}
                name="brand"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue placeholder="Select Brand" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                      <SelectItem value="gul_ahmed">
                        Gul Ahmed
                      </SelectItem>
                      <SelectItem value="sapphire">
                        Sapphire
                      </SelectItem>
                      <SelectItem value="j_dot">J.</SelectItem>
                      <SelectItem value="khaadi">
                        Khaadi
                      </SelectItem>
                      <SelectItem value="local">
                        Local Brand
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div>
              <Label className="text-gray-200">Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                      <SelectItem value="unstitched">
                        Unstitched
                      </SelectItem>
                      <SelectItem value="pret">
                        Pret (Ready to Wear)
                      </SelectItem>
                      <SelectItem value="bedding">
                        Bedding
                      </SelectItem>
                      <SelectItem value="fabric">
                        Raw Fabric
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div>
              <Label className="text-gray-200">
                Sub-Category
              </Label>
              <Controller
                control={control}
                name="subCategory"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue placeholder="Select Sub-Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                      <SelectItem value="men">
                        Men's Wear
                      </SelectItem>
                      <SelectItem value="women">
                        Women's Wear
                      </SelectItem>
                      <SelectItem value="kids">Kids</SelectItem>
                      <SelectItem value="accessories">
                        Accessories
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div>
              <Label className="text-gray-200">Unit</Label>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue placeholder="Select Unit" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                      <SelectItem value="pcs">
                        Pieces
                      </SelectItem>
                      <SelectItem value="meters">
                        Meters
                      </SelectItem>
                      <SelectItem value="suits">
                        Suits
                      </SelectItem>
                      <SelectItem value="kg">
                        Kilogram
                      </SelectItem>
                      <SelectItem value="yard">
                        Yards
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Pricing Strategy */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-l-4 border-green-500 pl-3 flex items-center gap-2">
            <DollarSign size={20} />
            Pricing
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-200">
                Purchase Price
              </Label>
              <Input
                type="number"
                {...register("purchasePrice")}
                placeholder="0.00"
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200">
                Profit Margin (%)
              </Label>
              <Input
                type="number"
                {...register("margin")}
                placeholder="0"
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200">
                Selling Price *
              </Label>
              <Input
                type="number"
                {...register("sellingPrice")}
                placeholder="0.00"
                className={clsx(
                  "bg-green-900/30 border-green-700 text-white mt-1 font-bold",
                  errors.sellingPrice &&
                    "border-red-500 ring-1 ring-red-500",
                )}
              />
              {errors.sellingPrice && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.sellingPrice.message}
                </p>
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <Label className="text-gray-200">Tax Type</Label>
            <Controller
              control={control}
              name="taxType"
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue placeholder="Select Tax Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800 text-white">
                    <SelectItem value="exclusive">
                      Exclusive (Tax Added)
                    </SelectItem>
                    <SelectItem value="inclusive">
                      Inclusive (Tax Included)
                    </SelectItem>
                    <SelectItem value="exempt">
                      Tax Exempt
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Collapsible Rental Options */}
          <Collapsible
            open={isRentalOptionsOpen}
            onOpenChange={setIsRentalOptionsOpen}
            className="border border-gray-800 rounded-lg bg-gray-800/20"
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 text-sm font-medium hover:bg-gray-800/50 rounded-t-lg transition-colors">
              <span className="flex items-center gap-2">
                Rental Options{" "}
                <span className="text-gray-500 font-normal">
                  (Optional)
                </span>
              </span>
              <ChevronDown
                className={clsx(
                  "h-4 w-4 transition-transform duration-200",
                  isRentalOptionsOpen
                    ? "transform rotate-180"
                    : "",
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4">
                <div className="bg-blue-900/10 border border-blue-900/30 p-3 rounded-md text-xs text-blue-300 mb-4">
                  Leave these fields empty to decide the rental
                  price at the time of booking.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-200">
                      Default Rent Price
                    </Label>
                    <Input
                      type="number"
                      {...register("rentalPrice")}
                      placeholder="0.00"
                      className="bg-gray-800 border-gray-700 text-white mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-200">
                      Security Deposit
                    </Label>
                    <Input
                      type="number"
                      {...register("securityDeposit")}
                      placeholder="0.00"
                      className="bg-gray-800 border-gray-700 text-white mt-1"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Section 4: Stock Management */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold border-l-4 border-yellow-500 pl-3">
              Stock Management
            </h3>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="stock-mgmt"
                className="text-gray-200"
              >
                Enable Tracking
              </Label>
              <Controller
                control={control}
                name="stockManagement"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="stock-mgmt"
                  />
                )}
              />
            </div>
          </div>

          {stockManagement && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="initial-stock"
                  className="text-gray-200"
                >
                  Initial Stock
                </Label>
                <Input
                  id="initial-stock"
                  type="number"
                  {...register("initialStock")}
                  placeholder="0"
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                />
              </div>

              <div>
                <Label
                  htmlFor="alert-qty"
                  className="text-gray-200"
                >
                  Alert Quantity
                </Label>
                <Input
                  id="alert-qty"
                  type="number"
                  {...register("alertQty")}
                  placeholder="5"
                  className="bg-gray-800 border-red-900/50 text-white mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get notified when stock falls below this level
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Accordion: Advanced Details */}
        <Accordion
          type="multiple"
          className="border border-gray-800 rounded-lg"
        >
          <AccordionItem
            value="description"
            className="border-b border-gray-800"
          >
            <AccordionTrigger className="px-4 hover:bg-gray-800/50">
              <span className="text-sm font-medium">
                Description & Notes
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="description"
                    className="text-gray-200"
                  >
                    Product Description
                  </Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Detailed product description..."
                    className="bg-gray-800 border-gray-700 text-white mt-1 min-h-[80px]"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="notes"
                    className="text-gray-200"
                  >
                    Internal Notes
                  </Label>
                  <Textarea
                    id="notes"
                    {...register("notes")}
                    placeholder="Private notes (not visible to customers)..."
                    className="bg-gray-800 border-gray-700 text-white mt-1 min-h-[60px]"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="media"
            className="border-b border-gray-800"
          >
            <AccordionTrigger className="px-4 hover:bg-gray-800/50">
              <span className="text-sm font-medium">
                Product Images
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div
                {...getRootProps()}
                className={clsx(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 hover:border-gray-500 bg-gray-800/50",
                )}
              >
                <input {...getInputProps()} />
                <Upload
                  size={32}
                  className="text-gray-500 mb-3"
                />
                <p className="text-gray-400 text-center">
                  Drag & drop images here, or{" "}
                  <span className="text-blue-500">browse</span>
                </p>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  {images.map((file, idx) => (
                    <div
                      key={idx}
                      className="relative group aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setImages(
                            images.filter((_, i) => i !== idx),
                          );
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="supplier">
            <AccordionTrigger className="px-4 hover:bg-gray-800/50">
              <span className="text-sm font-medium">
                Supplier Information
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-200">
                    Default Supplier
                  </Label>
                  <Controller
                    control={control}
                    name="supplier"
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                          <SelectValue placeholder="Select Supplier" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-800 text-white">
                          <SelectItem value="bilal">
                            Bilal Fabrics
                          </SelectItem>
                          <SelectItem value="chenone">
                            ChenOne
                          </SelectItem>
                          <SelectItem value="sapphire">
                            Sapphire Mills
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label className="text-gray-200">
                    Supplier Product Code
                  </Label>
                  <Input
                    {...register("supplierCode")}
                    placeholder="Supplier's SKU"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="p-6 border-t border-gray-800 bg-gray-900 sticky bottom-0 z-10 flex gap-4">
        <button
          onClick={onCancel}
          className="px-6 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors border border-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit((data) =>
            onSubmit(data, "save"),
          )}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold transition-colors"
        >
          Save Product
        </button>
        {onSaveAndAdd && (
          <button
            onClick={handleSubmit((data) =>
              onSubmit(data, "saveAndAdd"),
            )}
            className="flex-[2] bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20"
          >
            Save & Add to Transaction
          </button>
        )}
      </div>
    </div>
  );
};