# 💬 Real-Time Chat Application with WebRTC & End-to-End Encryption

![React](https://img.shields.io/badge/React-19.2.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.2-blue)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8.1-orange)
![WebRTC](https://img.shields.io/badge/WebRTC-Supported-lightblue)
![MongoDB](https://img.shields.io/badge/MongoDB-8.5.0-green)
![Redis](https://img.shields.io/badge/Redis-7.x-red)

A full-featured, production-ready chat application with video/audio calls, end-to-end encryption, and real-time messaging built with modern technologies.

## ✨ Features

### 🎯 Core Features
- **Real-time messaging** with Socket.io
- **Video & Audio calls** using WebRTC
- **End-to-end encryption** for messages & files
- **Multiple chat rooms** with user management
- **File sharing** with encrypted uploads
- **Online status** tracking with Redis
- **Typing indicators** in real-time

### 🔒 Security Features
- JWT-based authentication
- End-to-end encryption using Web Crypto API
- Password hashing with bcryptjs
- File encryption (AES-GCM)
- Message signature verification

### 🚀 Advanced Features
- **Screen sharing** during video calls
- **Message deletion** with 15-minute time limit
- **Read receipts** and delivery status
- **Pagination** for message history
- **Responsive design** with Tailwind CSS

## 🏗️ Architecture
```
┌─────────────────┐ WebSocket ┌─────────────────┐
│ React Frontend│◄────────────────►│ Node.js Backend│
│ │ HTTP/REST │ │
│ • TypeScript │◄────────────────►│ • Express │
│ • Tailwind CSS│ │ • TypeScript │
│ • WebRTC │ │ • Socket.io │
└─────────────────┘ └────────┬────────┘
│
┌────────┴────────┐
│ │
│ Data Layer │
│ │
│ • MongoDB │
│ • Redis │
└─────────────────┘
```

## 🛠️ Tech Stack

**Frontend:**
- React 19 with TypeScript
- Socket.io-client for real-time communication
- WebRTC with Simple-Peer for video calls
- Tailwind CSS for styling
- Web Crypto API for encryption

**Backend:**
- Node.js with Express & TypeScript
- Socket.io for WebSocket communication
- MongoDB with Mongoose ODM
- Redis for caching & real-time data
- JWT for authentication
- Multer for file uploads

**DevOps:**
- Docker & Docker Compose
- TypeScript across entire stack

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- MongoDB (or use Docker)
- Redis (or use Docker)

### Using Docker (Recommended)
```bash
# Clone the repository
git clone https://github.com/yourusername/real-time-chat-app.git
cd real-time-chat-app

# Start all services
docker-compose up

# Access at:
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
Manual Setup
bash
# Backend setup
cd server
npm install
cp .env.example .env
npm run dev

# Frontend setup (new terminal)
cd client
npm install
cp .env.local.example .env.local
npm start
```

## 📁 Project Structure
```text
real-time-chat-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts (Auth, Chat, etc.)
│   │   ├── services/       # API, WebRTC, encryption services
│   │   └── pages/          # Page components
│   └── Dockerfile.dev
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # REST API routes
│   │   ├── socket/         # Socket.io handlers
│   │   └── services/       # Business logic
│   └── Dockerfile.dev
├── shared/                 # Shared TypeScript types
├── docker-compose.yml      # Development environment
└── README.md              # This file
```

## 🔐 Environment Variables
```Backend (.env)
env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chat-app
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
CLIENT_URL=http://localhost:3000
```
```Frontend (.env.local)
env
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_API_URL=http://localhost:5000/api
```

## 🧪 Testing the Application
1. Register a new account
2. Create a chat room or join existing ones
3. Send messages and see real-time updates
4. Start a video call with room members
5. Upload files and see encryption in action
6. Test typing indicators and online status

## 📸 Screenshots

Login/Register page
<img width="1908" height="2044" alt="image" src="https://github.com/user-attachments/assets/c928d214-868c-4a62-88f4-de3837e85983" />
<img width="1908" height="1585" alt="image" src="https://github.com/user-attachments/assets/c33eef93-f766-4ede-bbc6-f8604f037090" />
<img width="1908" height="2044" alt="image" src="https://github.com/user-attachments/assets/ded57a99-37c7-4533-a57b-1f37a5e2dbcd" />
<img width="1908" height="1585" alt="image" src="https://github.com/user-attachments/assets/68fc990b-222b-4039-b6b4-25a95aeefa78" />

Chat interface
<img width="1908" height="1002" alt="image" src="https://github.com/user-attachments/assets/98f229d5-b2bb-4c6d-833e-0e86861c3938" />
<img width="1908" height="1002" alt="image" src="https://github.com/user-attachments/assets/b07ab1d0-a657-4492-8adb-ff7614c8e47e" />

Video call in progress
<img width="1908" height="1002" alt="image" src="https://github.com/user-attachments/assets/edb3f550-2a08-415f-9cb2-6f7fbc68ecfd" />

File upload dialog
<img width="1908" height="1066" alt="image" src="https://github.com/user-attachments/assets/90e1125c-ee05-4c9d-bae9-6abdb2617e06" />

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments
- Socket.io for real-time communication
- Simple-Peer for WebRTC abstraction
- Web Crypto API for encryption
- Tailwind CSS for styling

## ⭐ Star this repo if you found it helpful!
