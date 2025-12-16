import React, { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatAPI } from '../../services/api';

interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  online: boolean;
}

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserSearchModal: React.FC<UserSearchModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { currentRoom, addMembersToRoom } = useChat();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && searchTerm.trim()) {
      const timer = setTimeout(() => {
        searchUsers();
      }, 300);
      
      return () => clearTimeout(timer);
    } else if (isOpen && !searchTerm.trim()) {
      setUsers([]);
    }
  }, [searchTerm, isOpen]);

  const searchUsers = async () => {
    if (!searchTerm.trim()) {
      setUsers([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await chatAPI.searchUsers(searchTerm);
      // Filter out current user and existing room members
      const filteredUsers = response.data.users.filter((u: User) => {
        if (u._id === user?._id) return false;
        if (currentRoom?.members.some(member => member._id === u._id)) return false;
        return true;
      });
      setUsers(filteredUsers);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to search users');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddUsers = async () => {
    if (!currentRoom || selectedUsers.length === 0) return;

    try {
      await addMembersToRoom(currentRoom._id, selectedUsers);
      onClose();
      setSelectedUsers([]);
      setSearchTerm('');
      setUsers([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add users to room');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
      setSelectedUsers([]);
      setSearchTerm('');
      setUsers([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Add Members
              </h2>
              {currentRoom && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  to {currentRoom.name}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                onClose();
                setSelectedUsers([]);
                setSearchTerm('');
                setUsers([]);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users by username or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-11 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-gray-100"
              />
              <div className="absolute left-3 top-3.5">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {isLoading && (
                <div className="absolute right-3 top-3">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Users List */}
          <div className="mb-6 max-h-64 overflow-y-auto">
            {users.length === 0 && searchTerm ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No users found
              </div>
            ) : users.length === 0 && !searchTerm ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Start typing to search for users
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user._id}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUsers.includes(user._id)
                        ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => handleSelectUser(user._id)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="relative">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                            <span className="text-white font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
                          user.online ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {user.username}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      selectedUsers.includes(user._id)
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {selectedUsers.includes(user._id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Users Count */}
          {selectedUsers.length > 0 && (
            <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{selectedUsers.length}</span> user{selectedUsers.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                onClose();
                setSelectedUsers([]);
                setSearchTerm('');
                setUsers([]);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddUsers}
              disabled={selectedUsers.length === 0}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSearchModal;