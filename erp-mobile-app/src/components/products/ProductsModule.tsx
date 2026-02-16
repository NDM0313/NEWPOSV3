import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Plus, Search, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as productsApi from '../../api/products';

interface ProductsModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  retailPrice: number;
  stock: number;
  unit: string;
  status: 'active' | 'inactive';
}

const MOCK_PRODUCTS: Product[] = [
  { id: '1', sku: 'BRD-001', name: 'Bridal Lehenga - Red & Gold', category: 'Bridal', costPrice: 12000, retailPrice: 15000, stock: 5, unit: 'Piece', status: 'active' },
  { id: '2', sku: 'DUP-002', name: 'Dupatta - Gold Embroidered', category: 'Accessories', costPrice: 4000, retailPrice: 5000, stock: 12, unit: 'Piece', status: 'active' },
  { id: '3', sku: 'FAB-003', name: 'Silk Fabric - Royal Blue', category: 'Fabric', costPrice: 1000, retailPrice: 1200, stock: 25, unit: 'Meter', status: 'active' },
  { id: '4', sku: 'JWL-004', name: 'Jewelry Set - Pearl', category: 'Accessories', costPrice: 8000, retailPrice: 12000, stock: 3, unit: 'Piece', status: 'active' },
];

function AddProductForm({
  onBack,
  onSave,
  saving,
  error,
}: {
  onBack: () => void;
  onSave: (p: Omit<Product, 'id'>) => void;
  saving: boolean;
  error: string;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Bridal');
  const [costPrice, setCostPrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('Piece');

  const handleSubmit = () => {
    if (!name.trim() || !sku.trim()) return;
    const cost = parseFloat(costPrice) || 0;
    const retail = parseFloat(retailPrice) || cost;
    const st = parseInt(stock, 10) || 0;
    onSave({
      sku: sku.trim(),
      name: name.trim(),
      category,
      costPrice: cost,
      retailPrice: retail,
      stock: st,
      unit,
      status: 'active',
    });
  };

  return (
    <div className="min-h-screen bg-[#111827] p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Add Product</h1>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">SKU *</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. BRD-001" className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#3B82F6]">
            <option value="Bridal">Bridal</option>
            <option value="Accessories">Accessories</option>
            <option value="Fabric">Fabric</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Cost (Rs)</label>
            <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0" className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Retail (Rs)</label>
            <input type="number" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} placeholder="0" className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Stock</label>
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Unit</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#3B82F6]">
              <option value="Piece">Piece</option>
              <option value="Meter">Meter</option>
              <option value="Yard">Yard</option>
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={handleSubmit} disabled={!name.trim() || !sku.trim() || saving} className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-white mt-4 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Save Product
        </button>
      </div>
    </div>
  );
}

export function ProductsModule({ onBack, user: _user, companyId }: ProductsModuleProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [view, setView] = useState<'list' | 'add'>('list');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    productsApi.getProducts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error) setProducts(MOCK_PRODUCTS);
      else setProducts(data);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  const handleSave = async (p: Omit<Product, 'id'>) => {
    if (!companyId) {
      setProducts([{ ...p, id: `p${Date.now()}` }, ...products]);
      setView('list');
      return;
    }
    setSaveError('');
    setSaving(true);
    const { data, error } = await productsApi.createProduct(companyId, {
      name: p.name,
      sku: p.sku,
      category: p.category,
      costPrice: p.costPrice,
      retailPrice: p.retailPrice,
      stock: p.stock,
      unit: p.unit,
    });
    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    if (data) setProducts([data, ...products]);
    setView('list');
  };

  if (view === 'add') {
    return (
      <AddProductForm
        onBack={() => setView('list')}
        onSave={handleSave}
        saving={saving}
        error={saveError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Products</h1>
          </div>
          <button onClick={() => setView('add')} className="p-2 bg-[#10B981] hover:bg-[#059669] rounded-lg text-white">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
        <>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU..." className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setFilterCat(cat)} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium capitalize ${filterCat === cat ? 'bg-[#3B82F6] text-white' : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-white">{p.name}</h3>
                  <p className="text-xs text-[#6B7280]">{p.sku} · {p.category}</p>
                  <p className="text-sm text-[#10B981] mt-1">Rs. {p.retailPrice.toLocaleString()} <span className="text-[#9CA3AF]">/ {p.unit}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">Stock: {p.stock}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#6B7280]/20 text-[#9CA3AF]'}`}>{p.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <p className="text-center text-[#6B7280] py-8">No products found</p>}
        </>
        )}
      </div>
    </div>
  );
}
