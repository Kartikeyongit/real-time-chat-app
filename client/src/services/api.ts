import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  getProfile: () => api.get('/auth/profile'),
  
  updateProfile: (data: { username?: string; avatar?: string }) =>
    api.put('/auth/profile', data),
  
  searchUsers: (query: string) =>
    api.get(`/auth/search?q=${encodeURIComponent(query)}`),
  
  validateToken: () => api.post('/auth/validate'),
};

// Chat API
export const chatAPI = {
  getRooms: () => api.get('/chat/rooms'),
  
  getRoom: (roomId: string) => api.get(`/chat/rooms/${roomId}`),
  
  createRoom: (data: { 
    name: string; 
    description?: string; 
    isPrivate?: boolean; 
    memberIds?: string[] 
  }) => api.post('/chat/rooms', data),
  
  addMembers: (roomId: string, userIds: string[]) =>
    api.post(`/chat/rooms/${roomId}/members`, { userIds }),
  
  getMessages: (roomId: string, page = 1, limit = 50) =>
    api.get(`/chat/rooms/${roomId}/messages?page=${page}&limit=${limit}`),
  
  markAsRead: (roomId: string, messageIds: string[]) =>
    api.post('/chat/messages/read', { roomId, messageIds }),

  searchUsers: (query: string) => 
    api.get(`/chat/users/search?q=${encodeURIComponent(query)}`),
  
};

// Upload API
export const uploadAPI = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  getFiles: () => api.get('/upload/files'),
  
  deleteFile: (fileId: string) => api.delete(`/upload/files/${fileId}`),
};

export default api;