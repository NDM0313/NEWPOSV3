import React, { useState } from 'react';
import { PullRequestList } from './PullRequestList';
import { PullRequestDetail } from './PullRequestDetail';
import { CreatePullRequestDialog } from './CreatePullRequestDialog';
import { GitHubPullRequest } from '../../services/githubService';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Key, AlertCircle, CheckCircle2 } from 'lucide-react';
import { githubService } from '../../services/githubService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';

export function GitHubPullRequestsPage() {
  const [selectedPR, setSelectedPR] = useState<GitHubPullRequest | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(githubService.isAuthenticated());

  const handleSelectPR = (pr: GitHubPullRequest) => {
    setSelectedPR(pr);
  };

  const handleBack = () => {
    setSelectedPR(null);
  };

  const handleCreateSuccess = () => {
    // Refresh will be handled by the list component
    setSelectedPR(null);
  };

  const handleSetToken = () => {
    if (!tokenInput.trim()) {
      toast.error('Token is required');
      return;
    }

    githubService.setToken(tokenInput);
    setIsAuthenticated(true);
    setTokenDialogOpen(false);
    setTokenInput('');
    toast.success('GitHub token set successfully');
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="w-16 h-16 text-gray-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">GitHub Authentication Required</h2>
            <p className="text-gray-400 text-center mb-6 max-w-md">
              To use the GitHub Pull Request system, you need to authenticate with a GitHub Personal Access Token.
            </p>
            <Button onClick={() => setTokenDialogOpen(true)}>
              <Key className="w-4 h-4 mr-2" />
              Set GitHub Token
            </Button>
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg max-w-md">
              <p className="text-sm text-gray-300 mb-2">
                <strong>How to create a GitHub Personal Access Token:</strong>
              </p>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Go to GitHub Settings → Developer settings → Personal access tokens</li>
                <li>Click "Generate new token (classic)"</li>
                <li>Select scopes: <code className="bg-gray-900 px-1 rounded">repo</code></li>
                <li>Copy the token and paste it here</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set GitHub Personal Access Token</DialogTitle>
              <DialogDescription>
                Enter your GitHub Personal Access Token to authenticate with the GitHub API
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Personal Access Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                />
                <p className="text-xs text-gray-400">
                  Your token is stored locally and never sent to our servers
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTokenDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSetToken}>
                Save Token
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (selectedPR) {
    return (
      <div className="p-6">
        <PullRequestDetail
          pr={selectedPR}
          onBack={handleBack}
          onRefresh={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PullRequestList
        onSelectPR={handleSelectPR}
        onCreateNew={() => setCreateDialogOpen(true)}
      />
      <CreatePullRequestDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
