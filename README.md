# Real-Time Collaborative Whiteboard

A full-stack collaborative whiteboard application that allows multiple users to draw, brainstorm, and collaborate in real time. Built with the MERN stack, Socket.IO, and Excalidraw, it features instant synchronization, role-based access control (RBAC), and secure JWT-based authentication.

## Core Features

- **Real-Time Synchronization:** Sub-millisecond latency drawing synchronization across multiple clients using Socket.IO.
- **Collaborative Canvas:** Powered by Excalidraw, supporting a rich set of drawing tools, shapes, and text.
- **Authentication & Security:** JWT-based session management, Google OAuth integration, and rate-limited API endpoints.
- **Presence Tracking:** Real-time visibility of active users within a room, including live cursors.
- **Role-Based Access Control (RBAC):** Room creators possess administrative privileges, allowing them to instantly kick unauthorized participants.
- **Optimized Persistence:** Debounced MongoDB snapshotting ensures board states are saved reliably without overwhelming the database.
- **Horizontal Scaling Ready:** Pre-configured with an optional Redis adapter for multi-instance Socket.IO deployments.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Excalidraw, Socket.IO Client.
- **Backend:** Node.js, Express, Socket.IO, Mongoose.
- **Infrastructure:** MongoDB (Data Persistence), Redis (Pub/Sub for scaling), Nodemailer (OTP Services).

---

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas)
- (Optional) [Redis](https://redis.io/) (For horizontal scaling)

## Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/Aditya-Prakash-Srivastava/Real-Time-Collaborative-Whiteboard.git
cd Real-Time-Collaborative-Whiteboard/whiteboard-app
```

### 2. Backend Configuration
Navigate to the backend directory, install dependencies, and configure your environment variables.

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/whiteboard
JWT_SECRET=your_super_secret_jwt_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Nodemailer (For OTP/Password Reset)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password

# Optional: Redis for Socket.IO horizontal scaling
# REDIS_URI=redis://localhost:6379
```

Start the backend development server:
```bash
npm start
```

### 3. Frontend Configuration
Open a new terminal window, navigate to the frontend directory, and install dependencies.

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:
```env
# Point this to your backend API
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Start the frontend Vite development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## Deployment Guidelines

This application is decoupled and ready for production deployment across serverless and standard containerized platforms.

### Frontend (Vercel)
1. Import the `frontend` directory into a new Vercel project.
2. Vercel will automatically detect the Vite framework.
3. Add the `VITE_API_URL` environment variable pointing to your deployed backend URL (e.g., `https://your-backend.up.railway.app`).
4. Add the `VITE_GOOGLE_CLIENT_ID` environment variable.
5. Deploy.

### Backend (Railway / Render)
1. Deploy the `backend` directory as a Node.js Web Service.
2. Add all environment variables from your local `.env` to the service configuration.
3. **Important:** If deploying across multiple instances, you **must** provide a `REDIS_URI` to enable the Socket.IO Redis Adapter. This ensures WebSocket broadcasts (like drawing updates) are routed correctly between instances.
4. Ensure your MongoDB cluster allows IP connections from your hosting provider.

## License
MIT License
