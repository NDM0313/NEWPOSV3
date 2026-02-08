import React, { useState, useEffect } from 'react';
import { githubService, GitHubPullRequest, PullRequestComment, PullRequestReview } from '../../services/githubService';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { 
  GitBranch, GitMerge, GitPullRequest, CheckCircle2, XCircle, Clock, 
  MessageSquare, ArrowLeft, FileText, User, Calendar, Code, 
  PlusCircle, Send, ThumbsUp, AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { Separator } from '../ui/separator';

interface PullRequestDetailProps {
  pr: GitHubPullRequest;
  onBack: () => void;
  onRefresh: () => void;
}

export function PullRequestDetail({ pr, onBack, onRefresh }: PullRequestDetailProps) {
  const [comments, setComments] = useState<PullRequestComment[]>([]);
  const [reviews, setReviews] = useState<PullRequestReview[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [pr.number]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const [commentsData, reviewsData, filesData] = await Promise.all([
        githubService.getPullRequestComments(pr.number),
        githubService.getPullRequestReviews(pr.number),
        githubService.getPullRequestFiles(pr.number),
      ]);
      setComments(commentsData);
      setReviews(reviewsData);
      setFiles(filesData);
    } catch (error: any) {
      toast.error(`Failed to load PR details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmittingComment(true);
      const comment = await githubService.addPullRequestComment(pr.number, newComment);
      setComments([...comments, comment]);
      setNewComment('');
      toast.success('Comment added successfully');
    } catch (error: any) {
      toast.error(`Failed to add comment: ${error.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleMerge = async () => {
    if (!confirm('Are you sure you want to merge this pull request?')) return;

    try {
      await githubService.mergePullRequest(pr.number);
      toast.success('Pull request merged successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(`Failed to merge: ${error.message}`);
    }
  };

  const handleClose = async () => {
    if (!confirm('Are you sure you want to close this pull request?')) return;

    try {
      await githubService.updatePullRequest(pr.number, { state: 'closed' });
      toast.success('Pull request closed');
      onRefresh();
    } catch (error: any) {
      toast.error(`Failed to close: ${error.message}`);
    }
  };

  const getStateIcon = () => {
    if (pr.merged) {
      return <GitMerge className="w-5 h-5 text-purple-500" />;
    }
    if (pr.state === 'open') {
      return <GitPullRequest className="w-5 h-5 text-green-500" />;
    }
    return <XCircle className="w-5 h-5 text-gray-500" />;
  };

  const getStateBadge = () => {
    if (pr.merged) {
      return <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">Merged</Badge>;
    }
    if (pr.state === 'open') {
      return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Open</Badge>;
    }
    return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">Closed</Badge>;
  };

  if (loading) {
    return <LoadingSpinner text="Loading pull request details..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {getStateIcon()}
            <h1 className="text-2xl font-bold text-white">{pr.title}</h1>
            {getStateBadge()}
            <span className="text-gray-400">#{pr.number}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {pr.user.login}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(pr.created_at), 'MMM d, yyyy')}
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="w-4 h-4" />
              {pr.head.ref} → {pr.base.ref}
            </span>
          </div>
        </div>
        {pr.state === 'open' && !pr.merged && (
          <div className="flex gap-2">
            <Button onClick={handleMerge} className="bg-green-600 hover:bg-green-700">
              <GitMerge className="w-4 h-4 mr-2" />
              Merge
            </Button>
            <Button onClick={handleClose} variant="destructive">
              Close
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-2xl font-bold">{pr.changed_files}</p>
                <p className="text-xs text-gray-400">Files Changed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-400">+{pr.additions}</p>
                <p className="text-xs text-gray-400">Additions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-red-400">-{pr.deletions}</p>
                <p className="text-xs text-gray-400">Deletions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold">{pr.comments}</p>
                <p className="text-xs text-gray-400">Comments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <Tabs defaultValue="description" className="w-full">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
          <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="description" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                {pr.body ? (
                  <p className="whitespace-pre-wrap text-gray-300">{pr.body}</p>
                ) : (
                  <p className="text-gray-400 italic">No description provided</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Comment */}
          <Card>
            <CardHeader>
              <CardTitle>Add Comment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Leave a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={4}
              />
              <Button onClick={handleAddComment} disabled={!newComment.trim() || submittingComment}>
                <Send className="w-4 h-4 mr-2" />
                {submittingComment ? 'Posting...' : 'Post Comment'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-2">
          {files.map((file, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="font-mono text-sm">{file.filename}</span>
                    <Badge variant="outline" className="ml-2">{file.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-400">+{file.additions}</span>
                    <span className="text-red-400">-{file.deletions}</span>
                    <span className="text-gray-400">{file.changes} changes</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="comments" className="space-y-4">
          {comments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                No comments yet
              </CardContent>
            </Card>
          ) : (
            comments.map((comment) => (
              <Card key={comment.id}>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <Avatar>
                      <AvatarImage src={comment.user.avatar_url} />
                      <AvatarFallback>{comment.user.login[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{comment.user.login}</span>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                No reviews yet
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <Avatar>
                      <AvatarImage src={review.user.avatar_url} />
                      <AvatarFallback>{review.user.login[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{review.user.login}</span>
                        <Badge
                          className={
                            review.state === 'APPROVED'
                              ? 'bg-green-500/10 text-green-400'
                              : review.state === 'CHANGES_REQUESTED'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                          }
                        >
                          {review.state.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(review.submitted_at), { addSuffix: true })}
                        </span>
                      </div>
                      {review.body && (
                        <p className="text-gray-300 whitespace-pre-wrap">{review.body}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
