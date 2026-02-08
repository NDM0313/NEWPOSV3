import React, { useState, useEffect } from 'react';
import { githubService, GitHubPullRequest } from '../../services/githubService';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { GitBranch, GitMerge, GitPullRequest, CheckCircle2, XCircle, Clock, MessageSquare, Plus, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { toast } from 'sonner';

interface PullRequestListProps {
  onSelectPR: (pr: GitHubPullRequest) => void;
  onCreateNew: () => void;
}

export function PullRequestList({ onSelectPR, onCreateNew }: PullRequestListProps) {
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPullRequests();
  }, [filter]);

  const loadPullRequests = async () => {
    try {
      setLoading(true);
      const prs = await githubService.getPullRequests({
        state: filter === 'all' ? 'all' : filter,
        sort: 'updated',
        direction: 'desc',
        per_page: 50,
      });
      setPullRequests(prs);
    } catch (error: any) {
      toast.error(`Failed to load pull requests: ${error.message}`);
      console.error('Error loading pull requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPRs = pullRequests.filter(pr =>
    pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.number.toString().includes(searchQuery)
  );

  const getStateIcon = (pr: GitHubPullRequest) => {
    if (pr.merged) {
      return <GitMerge className="w-4 h-4 text-purple-500" />;
    }
    if (pr.state === 'open') {
      return <GitPullRequest className="w-4 h-4 text-green-500" />;
    }
    return <XCircle className="w-4 h-4 text-gray-500" />;
  };

  const getStateBadge = (pr: GitHubPullRequest) => {
    if (pr.merged) {
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">Merged</Badge>;
    }
    if (pr.state === 'open') {
      return <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Open</Badge>;
    }
    return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">Closed</Badge>;
  };

  if (loading) {
    return <LoadingSpinner text="Loading pull requests..." />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Pull Requests</h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage and review pull requests from GitHub
          </p>
        </div>
        <Button onClick={onCreateNew} className="gap-2">
          <Plus className="w-4 h-4" />
          New Pull Request
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search pull requests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-md"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={loadPullRequests}
          className="gap-2"
        >
          <Clock className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* PR List */}
      {filteredPRs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitPullRequest className="w-12 h-12 text-gray-500 mb-4" />
            <p className="text-gray-400 text-center">
              {searchQuery ? 'No pull requests match your search' : 'No pull requests found'}
            </p>
            {!searchQuery && (
              <Button onClick={onCreateNew} variant="outline" className="mt-4">
                Create Your First Pull Request
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPRs.map((pr) => (
            <Card
              key={pr.id}
              className="cursor-pointer hover:bg-gray-800/50 transition-colors"
              onClick={() => onSelectPR(pr)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStateIcon(pr)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{pr.title}</CardTitle>
                        {getStateBadge(pr)}
                      </div>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {pr.head.ref} → {pr.base.ref}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {pr.comments}
                        </span>
                        <span className="text-xs">
                          {formatDistanceToNow(new Date(pr.updated_at), { addSuffix: true })}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pr.additions > 0 && (
                      <Badge variant="outline" className="text-green-400 border-green-500/20">
                        +{pr.additions}
                      </Badge>
                    )}
                    {pr.deletions > 0 && (
                      <Badge variant="outline" className="text-red-400 border-red-500/20">
                        -{pr.deletions}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              {pr.body && (
                <CardContent>
                  <p className="text-sm text-gray-400 line-clamp-2">{pr.body}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
