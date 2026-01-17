import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Phone, 
  MapPin,
  Plus,
  Trash2,
  Edit,
  Eye,
  Check
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "../ui/dialog";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const initialVendors = [
  { id: 1, name: 'Ali Dyer', type: 'Dyer', phone: '+92 300 1112222', location: 'Lahore', status: 'Active', orders: 5 },
  { id: 2, name: 'Master Sahab', type: 'Tailor', phone: '+92 321 3334444', location: 'Karachi', status: 'Busy', orders: 12 },
  { id: 3, name: 'Embroidery Works', type: 'Embroiderer', phone: '+92 333 5556666', location: 'Faisalabad', status: 'Active', orders: 2 },
  { id: 4, name: 'Silk Traders', type: 'Fabric Supplier', phone: '+92 300 7778888', location: 'Lahore', status: 'Active', orders: 0 },
];

export const VendorList = () => {
  const [vendorList, setVendorList] = useState(initialVendors);
  
  // Add/Edit Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    phone: '',
    location: ''
  });

  // View Details Dialog State
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<typeof initialVendors[0] | null>(null);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ name: '', type: '', phone: '', location: '' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (vendor: typeof initialVendors[0]) => {
    setEditingId(vendor.id);
    setFormData({
      name: vendor.name,
      type: vendor.type,
      phone: vendor.phone,
      location: vendor.location
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.type) return;
    
    if (editingId) {
      // Update existing
      setVendorList(vendorList.map(v => 
        v.id === editingId 
          ? { ...v, ...formData } 
          : v
      ));
    } else {
      // Create new
      const newId = Math.max(...vendorList.map(v => v.id), 0) + 1;
      setVendorList([...vendorList, {
        id: newId,
        name: formData.name,
        type: formData.type,
        phone: formData.phone || 'N/A',
        location: formData.location || 'N/A',
        status: 'Active',
        orders: 0
      }]);
    }
    
    setIsDialogOpen(false);
  };

  const handleDeleteVendor = (id: number) => {
    setVendorList(vendorList.filter(v => v.id !== id));
  };

  const handleViewDetails = (vendor: typeof initialVendors[0]) => {
    setSelectedVendor(vendor);
    setIsViewOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 p-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Vendor Management
          </h2>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Manage your dyers, tailors, and material suppliers.
          </p>
        </div>
        <Button 
          onClick={handleOpenAdd}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {/* Toolbar */}
      <div 
        className="flex gap-4 items-center p-4 rounded-xl border"
        style={{
          backgroundColor: 'rgba(31, 41, 55, 0.5)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="relative flex-1 max-w-md">
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--color-text-tertiary)' }}
          />
          <Input 
            placeholder="Search vendors..." 
            className="pl-9"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-primary)'
            }}
          />
        </div>
        <Button 
          variant="outline" 
          size="icon"
          style={{
            borderColor: 'var(--color-border-secondary)',
            color: 'var(--color-text-primary)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Filter size={18} />
        </Button>
      </div>

      {/* Table */}
      <div 
        className="border rounded-xl overflow-hidden"
        style={{
          borderColor: 'var(--color-border-primary)',
          backgroundColor: 'rgba(31, 41, 55, 0.3)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <Table>
          <TableHeader style={{ backgroundColor: 'rgba(17, 24, 39, 0.5)' }}>
            <TableRow 
              style={{ borderColor: 'var(--color-border-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(17, 24, 39, 0.5)';
              }}
            >
              <TableHead style={{ color: 'var(--color-text-secondary)' }}>Vendor Name</TableHead>
              <TableHead style={{ color: 'var(--color-text-secondary)' }}>Service Type</TableHead>
              <TableHead style={{ color: 'var(--color-text-secondary)' }}>Contact</TableHead>
              <TableHead style={{ color: 'var(--color-text-secondary)' }}>Location</TableHead>
              <TableHead style={{ color: 'var(--color-text-secondary)' }}>Active Orders</TableHead>
              <TableHead className="text-center" style={{ color: 'var(--color-text-secondary)' }}>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendorList.map((vendor) => (
              <TableRow 
                key={vendor.id}
                className="transition-colors"
                style={{ borderColor: 'var(--color-border-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <TableCell 
                  className="font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {vendor.name}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    style={{
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)',
                      backgroundColor: 'var(--color-bg-tertiary)'
                    }}
                  >
                    {vendor.type}
                  </Badge>
                </TableCell>
                <TableCell 
                  className="flex items-center gap-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <Phone size={14} /> {vendor.phone}
                </TableCell>
                <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} /> {vendor.location}
                  </div>
                </TableCell>
                <TableCell 
                  className="pl-8"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {vendor.orders}
                </TableCell>
                <TableCell className="text-center">
                  <span 
                    className="px-2 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: vendor.status === 'Active' 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : vendor.status === 'Busy' 
                        ? 'rgba(249, 115, 22, 0.1)' 
                        : 'var(--color-bg-tertiary)',
                      color: vendor.status === 'Active' 
                        ? 'var(--color-success)' 
                        : vendor.status === 'Busy' 
                        ? 'var(--color-warning)' 
                        : 'var(--color-text-tertiary)',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    {vendor.status}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-tertiary)';
                        }}
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-40"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border-primary)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--color-text-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={() => handleViewDetails(vendor)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--color-text-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={() => handleOpenEdit(vendor)}
                      >
                        <Edit className="mr-2 h-4 w-4" /> Edit Vendor
                      </DropdownMenuItem>
                      <DropdownMenuSeparator style={{ backgroundColor: 'var(--color-border-primary)' }} />
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--color-error)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={() => handleDeleteVendor(vendor.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Vendor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="sm:max-w-[425px]"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            color: 'var(--color-text-primary)'
          }}
        >
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label 
                htmlFor="name"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Vendor Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                placeholder="e.g. Ustad Aslam"
              />
            </div>
            <div className="grid gap-2">
              <Label 
                htmlFor="type"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Service Type
              </Label>
              <Select
                value={formData.type}
                onValueChange={(val) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger 
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent 
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectItem value="Dyer">Dyer</SelectItem>
                  <SelectItem value="Tailor">Tailor</SelectItem>
                  <SelectItem value="Embroiderer">Embroiderer</SelectItem>
                  <SelectItem value="Fabric Supplier">Fabric Supplier</SelectItem>
                  <SelectItem value="Designer">Designer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label 
                htmlFor="phone"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Phone Number
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                placeholder="+92 300 1234567"
              />
            </div>
            <div className="grid gap-2">
              <Label 
                htmlFor="location"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                placeholder="e.g. Lahore"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              style={{
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              }}
            >
              {editingId ? 'Update Vendor' : 'Save Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent 
          className="sm:max-w-[425px]"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            color: 'var(--color-text-primary)'
          }}
        >
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
               Complete information for {selectedVendor?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedVendor && (
            <div className="grid gap-6 py-4">
              <div 
                className="flex items-center gap-4 p-4 rounded-lg border"
                style={{
                  backgroundColor: 'rgba(17, 24, 39, 0.5)',
                  borderColor: 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div 
                  className="h-12 w-12 rounded-full flex items-center justify-center font-bold text-xl"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: 'var(--color-primary)',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  {selectedVendor.name.charAt(0)}
                </div>
                <div>
                  <h3 
                    className="font-bold text-lg"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {selectedVendor.name}
                  </h3>
                  <Badge 
                    variant="outline" 
                    className="mt-1"
                    style={{
                      borderColor: 'var(--color-border-secondary)',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    {selectedVendor.type}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className="p-3 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-primary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <p 
                      className="text-xs mb-1"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Status
                    </p>
                    <span 
                      className="text-sm font-medium"
                      style={{
                        color: selectedVendor.status === 'Active' 
                          ? 'var(--color-success)' 
                          : 'var(--color-warning)'
                      }}
                    >
                      {selectedVendor.status}
                    </span>
                  </div>
                   <div 
                    className="p-3 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-primary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <p 
                      className="text-xs mb-1"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Active Orders
                    </p>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedVendor.orders} Orders
                    </span>
                  </div>
                </div>

                <div 
                  className="space-y-3 p-4 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <div className="flex items-center gap-3 text-sm">
                    <Phone 
                      className="h-4 w-4"
                      style={{ color: 'var(--color-text-secondary)' }}
                    />
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {selectedVendor.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin 
                      className="h-4 w-4"
                      style={{ color: 'var(--color-text-secondary)' }}
                    />
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {selectedVendor.location}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
             <Button 
               onClick={() => setIsViewOpen(false)}
               className="w-full"
               style={{
                 backgroundColor: 'var(--color-bg-tertiary)',
                 color: 'var(--color-text-primary)'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
               }}
             >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
