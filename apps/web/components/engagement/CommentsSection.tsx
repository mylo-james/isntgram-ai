'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient, CommentResponse, CreateCommentRequest } from '../../lib/api-client';
import Button from '../ui/Button';

interface CommentsSectionProps {
  postId: string;
  currentUserId?: string;
  onCommentCountChange?: (count: number) => void;
}

interface CommentItemProps {
  comment: CommentResponse;
  currentUserId?: string;
  onCommentDeleted: () => void;
  onCommentUpdated: (comment: CommentResponse) => void;
}

function CommentItem({ comment, currentUserId, onCommentDeleted, onCommentUpdated }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleUpdate = async () => {
    if (!editContent.trim() || loading) return;

    setLoading(true);
    try {
      const updatedComment = await apiClient.updateComment(comment.id, {
        content: editContent.trim()
      });
      onCommentUpdated(updatedComment);
      setEditing(false);
    } catch (error) {
      console.error('Error updating comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (loading) return;

    setLoading(true);
    try {
      await apiClient.deleteComment(comment.id);
      onCommentDeleted();
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    
    return d.toLocaleDateString();
  };

  const canEdit = currentUserId === comment.userId;

  return (
    <div className="flex space-x-3 py-2">
      {comment.user?.profilePictureUrl ? (
        <img
          src={comment.user.profilePictureUrl}
          alt={`${comment.user.username}'s profile`}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-gray-600 font-medium text-sm">
            {comment.user?.fullName?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <Link 
            href={`/${comment.user?.username || 'user'}`}
            className="font-medium text-gray-900 hover:underline text-sm"
          >
            {comment.user?.username || 'Unknown User'}
          </Link>
          <span className="text-gray-500 text-xs">{formatDate(comment.createdAt)}</span>
          
          {canEdit && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-gray-400 hover:text-gray-600 p-1"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[80px]">
                  <button
                    onClick={() => {
                      setEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-1 text-sm text-red-600 hover:bg-gray-50"
                    disabled={loading}
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              maxLength={500}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500">{editContent.length}/500</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="text-xs text-gray-600 hover:text-gray-800"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  disabled={loading || !editContent.trim()}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>
    </div>
  );
}

export function CommentsSection({ postId, currentUserId, onCommentCountChange }: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadComments(1, true);
  }, [postId]);

  const loadComments = async (pageNum: number, reset = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      }

      const newComments = await apiClient.getPostComments(postId, pageNum, 20);
      
      if (reset) {
        setComments(newComments);
      } else {
        setComments(prev => [...prev, ...newComments]);
      }

      setHasMore(newComments.length === 20);
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId || commenting) return;

    setCommenting(true);
    try {
      const commentData: CreateCommentRequest = {
        postId,
        content: newComment.trim()
      };

      const comment = await apiClient.createComment(commentData);
      setComments(prev => [comment, ...prev]);
      setNewComment('');
      onCommentCountChange?.(comments.length + 1);
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setCommenting(false);
    }
  };

  const handleCommentDeleted = () => {
    loadComments(1, true);
    onCommentCountChange?.(Math.max(0, comments.length - 1));
  };

  const handleCommentUpdated = (updatedComment: CommentResponse) => {
    setComments(prev => prev.map(comment => 
      comment.id === updatedComment.id ? updatedComment : comment
    ));
  };

  const handleLoadMore = () => {
    loadComments(page + 1);
  };

  return (
    <div className="space-y-4">
      {/* Comment Form */}
      {currentUserId && (
        <form onSubmit={handleSubmitComment} className="border-b border-gray-200 pb-4">
          <div className="flex space-x-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-gray-600 font-medium text-sm">U</span>
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{newComment.length}/500</span>
                <Button
                  type="submit"
                  size="sm"
                  loading={commenting}
                  loadingText="Posting..."
                  disabled={!newComment.trim()}
                >
                  Post Comment
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-1">
        {loading && comments.length === 0 ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-300 rounded w-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No comments yet</p>
            {currentUserId && <p className="text-sm">Be the first to comment!</p>}
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                onCommentDeleted={handleCommentDeleted}
                onCommentUpdated={handleCommentUpdated}
              />
            ))}

            {hasMore && (
              <div className="pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadMore}
                  loading={loading}
                  loadingText="Loading..."
                >
                  Load More Comments
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}