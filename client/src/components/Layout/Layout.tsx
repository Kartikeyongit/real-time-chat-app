import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Don't show navigation on chat page - chat has its own header
  const isChatPage = location.pathname === '/chat';
  
  // Don't show navigation on homepage (root path)
  const isHomePage = location.pathname === '/';
  
  // Don't show navigation on auth pages either
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  
  // Only show navigation on authenticated pages that are NOT chat, home, or auth pages
  const showNavigation = user && !isChatPage && !isHomePage && !isAuthPage;

  if (isChatPage || isHomePage) {
    return <Outlet />; // Just render chat or home page without layout header
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* Only show navigation on specific authenticated pages */}
      {showNavigation && (
        <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 transition-colors duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white transition-colors duration-300">ChatApp</span>
            </div>
            
            <div className="flex items-center space-x-6">
              <Link to="/chat" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors duration-300">
                Chat
              </Link>
              
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="text-right hidden md:block">
                    <p className="font-medium text-gray-900 dark:text-white transition-colors duration-300">{user.username}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">Online</p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">
                      {user.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors duration-300"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;