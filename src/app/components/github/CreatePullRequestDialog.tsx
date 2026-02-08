import React, { useState, useEffect } from 'react';
import { githubService, CreatePullRequestParams } from '../../services/githubService';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { GitBranch } from 'lucide-react';

interface CreatePullRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreatePullRequestDialog({ open, onOpenChange, onSuccess }: CreatePullRequestDialogProps) {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Array<{ name: string }>>([]);
  const [formData, setFormData] = useState<CreatePullRequestParams>({
    title: '',
    body: '',
    head: '',
    base: 'main',
    draft: false,
  });

  useEffect(() => {
    if (open) {
      loadBranches();
    }
  }, [open]);

  const loadBranches = async () => {
    try {
      const branchData = await githubService.getBranches();
      setBranches(branchData);
      if (branchData.length > 0 && !formData.head) {
        setFormData(prev => ({ ...prev, head: branchData[0].name }));
      }
    } catch (error: any) {
      toast.error(`Failed to load branches: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!formData.head || !formData.base) {
      toast.error('Source and target branches are required');
      return;
    }

    if (formData.head === formData.base) {
      toast.error('Source and target branches must be different');
      return;
    }

    try {
      setLoading(true);
      const pr = await githubService.createPullRequest(formData);
      toast.success(`Pull request #${pr.number} created successfully!`);
      onSuccess();
      onOpenChange(false);
      // Reset form
      setFormData({
        title: '',
        body: '',
        head: branches[0]?.name || '',
        base: 'main',
        draft: false,
      });
    } catch (error: any) {
      toast.error(`Failed to create pull request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Create New Pull Request
          </DialogTitle>
          <DialogDescription>
            Create a pull request to merge changes from one branch into another
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Add a descriptive title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Description</Label>
            <Textarea
              id="body"
              placeholder="Describe the changes in this pull request..."
              value={formData.body}
              onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
              rows={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="head">Source Branch (head) *</Label>
              <Select
                value={formData.head}
                onValueChange={(value) => setFormData(prev => ({ ...prev, head: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="base">Target Branch (base) *</Label>
              <Select
                value={formData.base}
                onValueChange={(value) => setFormData(prev => ({ ...prev, base: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="draft">Draft Pull Request</Label>
              <p className="text-sm text-gray-400">
                Create as draft to indicate it's not ready for review
              </p>
            </div>
            <Switch
              id="draft"
              checked={formData.draft}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, draft: checked }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Pull Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
