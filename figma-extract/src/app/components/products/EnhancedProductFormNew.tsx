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
  const [isRentalOptionsOpen, setIsRentalOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'variations' | 'combos'>('basic');
  
  // Variations State
  const [variantAttributes, setVariantAttributes] = useState<Array<{
    name: string;
    values: string[];
  }>>([]);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [selectedAttributeIndex, setSelectedAttributeIndex] = useState<number | null>(null);
  const [generatedVariations, setGeneratedVariations] = useState<Array<{
    combination: Record<string, string>;
    sku: string;
    price: number;
    stock: number;
    barcode: string;
  }>>([]);

  // Combos State
  const [combos, setCombos] = useState<Array<{
    id: string;
    name: string;
    products: Array<{ name: string; quantity: number; price: number }>;
    totalPrice: number;
    comboPrice: number;
    discount: number;
  }>>([]);
  const [currentCombo, setCurrentCombo] = useState<Array<{ name: string; quantity: number; price: number }>>([]);
  const [newComboProduct, setNewComboProduct] = useState('');
  const [newComboQuantity, setNewComboQuantity] = useState(1);
  const [newComboPrice, setNewComboPrice] = useState(0);
  const [comboName, setComboName] = useState('');
  const [comboFinalPrice, setComboFinalPrice] = useState(0);

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
    return newSku;
  };

  const generateSKUForForm = () => {
    setValue("sku", generateSKU());
  };

  // Variations Functions
  const addVariantAttribute = () => {
    if (newAttributeName.trim() && !variantAttributes.some(attr => attr.name === newAttributeName.trim())) {
      setVariantAttributes([...variantAttributes, { name: newAttributeName.trim(), values: [] }]);
      setNewAttributeName('');
    }
  };

  const addAttributeValue = () => {
    if (selectedAttributeIndex !== null && newAttributeValue.trim()) {
      const updatedAttributes = [...variantAttributes];
      if (!updatedAttributes[selectedAttributeIndex].values.includes(newAttributeValue.trim())) {
        updatedAttributes[selectedAttributeIndex].values.push(newAttributeValue.trim());
        setVariantAttributes(updatedAttributes);
        setNewAttributeValue('');
      }
    }
  };

  const removeVariantAttribute = (attrName: string) => {
    setVariantAttributes(variantAttributes.filter(a => a.name !== attrName));
    setGeneratedVariations([]);
  };

  const removeAttributeValue = (attrIndex: number, valueIndex: number) => {
    const updatedAttributes = [...variantAttributes];
    updatedAttributes[attrIndex].values.splice(valueIndex, 1);
    setVariantAttributes(updatedAttributes);
    setGeneratedVariations([]);
  };

  const cartesianProduct = (arrays: string[][]): string[][] => {
    if (arrays.length === 0) return [[]];
    return arrays.reduce((a, b) => a.flatMap(d => b.map(e => [...(Array.isArray(d) ? d : [d]), e])), [[]] as string[][]);
  };

  const generateVariations = () => {
    const attributeValues = variantAttributes.map(attr => attr.values);
    const combinations = cartesianProduct(attributeValues);
    
    const newVariations = combinations.map(combination => {
      const combinationObj: Record<string, string> = {};
      variantAttributes.forEach((attr, index) => {
        combinationObj[attr.name] = combination[index];
      });
      
      return {
        combination: combinationObj,
        sku: generateSKU(),
        price: 0,
        stock: 0,
        barcode: '',
      };
    });
    
    setGeneratedVariations(newVariations);
  };

  // Combos Functions
  const addComboProduct = () => {
    if (newComboProduct.trim() && newComboQuantity > 0 && newComboPrice >= 0) {
      const newProduct = { name: newComboProduct.trim(), quantity: newComboQuantity, price: newComboPrice };
      setCurrentCombo([...currentCombo, newProduct]);
      setNewComboProduct('');
      setNewComboQuantity(1);
      setNewComboPrice(0);
    }
  };

  const removeComboProduct = (index: number) => {
    const updatedCombo = [...currentCombo];
    updatedCombo.splice(index, 1);
    setCurrentCombo(updatedCombo);
  };

  const saveCombo = () => {
    if (currentCombo.length > 0 && comboName.trim()) {
      const totalPrice = currentCombo.reduce((sum, product) => sum + product.quantity * product.price, 0);
      const discount = totalPrice - comboFinalPrice;
      
      const newCombo = {
        id: Date.now().toString(),
        name: comboName.trim(),
        products: currentCombo,
        totalPrice,
        comboPrice: comboFinalPrice,
        discount,
      };
      
      setCombos([...combos, newCombo]);
      setCurrentCombo([]);
      setComboName('');
      setComboFinalPrice(0);
    }
  };

  const deleteCombo = (id: string) => {
    setCombos(combos.filter(combo => combo.id !== id));
  };

  const onSubmit = (
    data: ProductFormValues,
    action: "save" | "saveAndAdd",
  ) => {
    const payload = {
      ...data,
      id: Date.now(),
      isSellable: true,
      isRentable: (data.rentalPrice || 0) > 0,
      variations: generatedVariations,
      combos: combos,
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

      {/* Tab Navigation */}
      <div className="border-b border-gray-800 bg-gray-900 sticky top-[89px] z-10">
        <div className="flex px-6">
          <button
            onClick={() => setActiveTab('basic')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'basic'
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-300"
            )}
          >
            Basic Info
          </button>
          <button
            onClick={() => setActiveTab('variations')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'variations'
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-300"
            )}
          >
            Variations {generatedVariations.length > 0 && `(${generatedVariations.length})`}
          </button>
          <button
            onClick={() => setActiveTab('combos')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'combos'
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-300"
            )}
          >
            Combos {combos.length > 0 && `(${combos.length})`}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* TAB 1 - BASIC INFO */}
        {activeTab === 'basic' && (
          <>
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
                      onClick={generateSKUForForm}
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
          </>
        )}

        {/* TAB 2 - VARIATIONS */}
        {activeTab === 'variations' && (
          <>
            {/* Info Banner */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
              <p className="text-sm text-blue-300">
                <strong>Product Variations:</strong> Create different variants of your product (e.g., different sizes, colors, materials). 
                Each variant will have its own SKU, price, and stock level.
              </p>
            </div>

            {/* Step 1: Add Attributes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-purple-500 pl-3">
                Step 1: Define Variation Attributes
              </h3>
              
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <Label className="text-gray-200 mb-2 block">Add New Attribute (e.g., Size, Color, Material)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newAttributeName}
                    onChange={(e) => setNewAttributeName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVariantAttribute())}
                    placeholder="Enter attribute name (e.g., Color)"
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                  <button
                    type="button"
                    onClick={addVariantAttribute}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>

              {/* Display Attributes */}
              {variantAttributes.length > 0 && (
                <div className="space-y-4">
                  {variantAttributes.map((attr, attrIndex) => (
                    <div key={attr.name} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          {attr.name}
                          <span className="text-xs text-gray-400 font-normal">
                            ({attr.values.length} values)
                          </span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeVariantAttribute(attr.name)}
                          className="text-red-500 hover:text-red-400 transition-colors p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Add Values */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={selectedAttributeIndex === attrIndex ? newAttributeValue : ''}
                            onFocus={() => setSelectedAttributeIndex(attrIndex)}
                            onChange={(e) => setNewAttributeValue(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setSelectedAttributeIndex(attrIndex);
                                addAttributeValue();
                              }
                            }}
                            placeholder={`Add ${attr.name} value (e.g., Red, Blue)`}
                            className="bg-gray-900 border-gray-700 text-white text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAttributeIndex(attrIndex);
                              addAttributeValue();
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                          >
                            Add Value
                          </button>
                        </div>
                      </div>

                      {/* Display Values */}
                      <div className="flex flex-wrap gap-2">
                        {attr.values.map((value, valueIndex) => (
                          <div
                            key={value}
                            className="bg-gray-900 border border-gray-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm"
                          >
                            <span>{value}</span>
                            <button
                              type="button"
                              onClick={() => removeAttributeValue(attrIndex, valueIndex)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {attr.values.length === 0 && (
                          <span className="text-gray-500 text-sm italic">No values added yet</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Generate Variations */}
            {variantAttributes.length > 0 && variantAttributes.every(attr => attr.values.length > 0) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-l-4 border-green-500 pl-3">
                  Step 2: Generate & Configure Variations
                </h3>
                
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <button
                    type="button"
                    onClick={generateVariations}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-green-500/20 flex items-center gap-2"
                  >
                    <RefreshCcw size={18} />
                    Generate {variantAttributes.reduce((acc, attr) => acc * attr.values.length, 1)} Variations
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    This will create all possible combinations of your attribute values
                  </p>
                </div>

                {/* Variations Table */}
                {generatedVariations.length > 0 && (
                  <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-900 border-b border-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">#</th>
                            {variantAttributes.map(attr => (
                              <th key={attr.name} className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                                {attr.name}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">SKU</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Price</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Stock</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Barcode</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedVariations.map((variation, index) => (
                            <tr key={index} className="border-b border-gray-700 hover:bg-gray-900/50 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-400">{index + 1}</td>
                              {variantAttributes.map(attr => (
                                <td key={attr.name} className="px-4 py-3 text-sm text-white">
                                  <span className="bg-blue-900/30 border border-blue-800 px-2 py-1 rounded text-xs">
                                    {variation.combination[attr.name]}
                                  </span>
                                </td>
                              ))}
                              <td className="px-4 py-3">
                                <Input
                                  value={variation.sku}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    updated[index].sku = e.target.value;
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-gray-900 border-gray-700 text-white text-sm w-32"
                                  placeholder="SKU"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="number"
                                  value={variation.price || ''}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    updated[index].price = parseFloat(e.target.value) || 0;
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-gray-900 border-gray-700 text-white text-sm w-24"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="number"
                                  value={variation.stock || ''}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    updated[index].stock = parseInt(e.target.value) || 0;
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-gray-900 border-gray-700 text-white text-sm w-20"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  value={variation.barcode}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    updated[index].barcode = e.target.value;
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-gray-900 border-gray-700 text-white text-sm w-32"
                                  placeholder="Barcode"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = generatedVariations.filter((_, i) => i !== index);
                                    setGeneratedVariations(updated);
                                  }}
                                  className="text-red-500 hover:text-red-400 transition-colors p-2"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="bg-gray-900 px-4 py-3 border-t border-gray-700">
                      <p className="text-sm text-gray-400">
                        Total Variations: <span className="text-white font-semibold">{generatedVariations.length}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {variantAttributes.length === 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
                <Package size={48} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No variation attributes added yet</p>
                <p className="text-sm text-gray-500">
                  Add attributes like Size, Color, or Material to create product variations
                </p>
              </div>
            )}
          </>
        )}

        {/* TAB 3 - COMBOS */}
        {activeTab === 'combos' && (
          <>
            {/* Info Banner */}
            <div className="bg-green-900/20 border border-green-800 rounded-xl p-4">
              <p className="text-sm text-green-300">
                <strong>Product Combos:</strong> Create bundled packages by combining multiple products. 
                Set a special combo price to offer discounts on bundle purchases.
              </p>
            </div>

            {/* Step 1: Create Combo */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-purple-500 pl-3">
                Create New Combo
              </h3>
              
              {/* Combo Name */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <Label className="text-gray-200 mb-2 block">Combo Name</Label>
                <Input
                  value={comboName}
                  onChange={(e) => setComboName(e.target.value)}
                  placeholder="e.g., Wedding Package, Summer Bundle"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>

              {/* Add Products to Combo */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                <Label className="text-gray-200 block">Add Products to Combo</Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Input
                    value={newComboProduct}
                    onChange={(e) => setNewComboProduct(e.target.value)}
                    placeholder="Product name"
                    className="bg-gray-900 border-gray-700 text-white text-sm md:col-span-2"
                  />
                  <Input
                    type="number"
                    value={newComboQuantity || ''}
                    onChange={(e) => setNewComboQuantity(parseInt(e.target.value) || 1)}
                    placeholder="Qty"
                    className="bg-gray-900 border-gray-700 text-white text-sm"
                  />
                  <Input
                    type="number"
                    value={newComboPrice || ''}
                    onChange={(e) => setNewComboPrice(parseFloat(e.target.value) || 0)}
                    placeholder="Price"
                    className="bg-gray-900 border-gray-700 text-white text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={addComboProduct}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Product
                </button>
              </div>

              {/* Current Combo Products */}
              {currentCombo.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                  <Label className="text-gray-200 block">Products in This Combo</Label>
                  <div className="space-y-2">
                    {currentCombo.map((product, index) => (
                      <div
                        key={index}
                        className="bg-gray-900 border border-gray-700 px-4 py-3 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-white font-medium">{product.name}</span>
                          <span className="text-gray-400 text-sm">Qty: {product.quantity}</span>
                          <span className="text-green-400 text-sm font-medium">₨{product.price.toFixed(2)}</span>
                          <span className="text-gray-500 text-sm">
                            Subtotal: ₨{(product.quantity * product.price).toFixed(2)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeComboProduct(index)}
                          className="text-red-500 hover:text-red-400 transition-colors p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Combo Pricing */}
                  <div className="border-t border-gray-700 pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Individual Price:</span>
                      <span className="text-white font-semibold">
                        ₨{currentCombo.reduce((sum, p) => sum + p.quantity * p.price, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="text-gray-200">Combo Price:</Label>
                      <Input
                        type="number"
                        value={comboFinalPrice || ''}
                        onChange={(e) => setComboFinalPrice(parseFloat(e.target.value) || 0)}
                        placeholder="Enter combo price"
                        className="bg-gray-900 border-gray-700 text-white flex-1"
                      />
                    </div>
                    {comboFinalPrice > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-green-400">Discount:</span>
                        <span className="text-green-400 font-semibold">
                          ₨{(currentCombo.reduce((sum, p) => sum + p.quantity * p.price, 0) - comboFinalPrice).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={saveCombo}
                    disabled={!comboName.trim() || comboFinalPrice <= 0}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-green-500/20 w-full"
                  >
                    Save Combo
                  </button>
                </div>
              )}
            </div>

            {/* Saved Combos */}
            {combos.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-l-4 border-green-500 pl-3">
                  Saved Combos ({combos.length})
                </h3>
                
                <div className="space-y-3">
                  {combos.map((combo) => (
                    <div key={combo.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold text-white">{combo.name}</h4>
                        <button
                          type="button"
                          onClick={() => deleteCombo(combo.id)}
                          className="text-red-500 hover:text-red-400 transition-colors p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {combo.products.map((product, idx) => (
                          <div key={idx} className="bg-gray-900 border border-gray-700 px-3 py-2 rounded-lg flex items-center justify-between text-sm">
                            <span className="text-white">{product.name}</span>
                            <div className="flex items-center gap-4 text-gray-400">
                              <span>Qty: {product.quantity}</span>
                              <span>₨{product.price.toFixed(2)}</span>
                              <span className="text-white">₨{(product.quantity * product.price).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-gray-700 pt-3 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Total Individual Price:</span>
                          <span className="text-white">₨{combo.totalPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-400">Combo Price:</span>
                          <span className="text-green-400 font-bold">₨{combo.comboPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-400">You Save:</span>
                          <span className="text-blue-400 font-semibold">₨{combo.discount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {combos.length === 0 && currentCombo.length === 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
                <Package size={48} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No combos created yet</p>
                <p className="text-sm text-gray-500">
                  Start adding products above to create your first combo package
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-6 border-t border-gray-800 bg-gray-900 sticky bottom-0 z-10 flex gap-4">
        <button
          onClick={onCancel}
          type="button"
          className="px-6 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors border border-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit((data) =>
            onSubmit(data, "save"),
          )}
          type="button"
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold transition-colors"
        >
          Save Product
        </button>
        {onSaveAndAdd && (
          <button
            onClick={handleSubmit((data) =>
              onSubmit(data, "saveAndAdd"),
            )}
            type="button"
            className="flex-[2] bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20"
          >
            Save & Add to Transaction
          </button>
        )}
      </div>
    </div>
  );
};
