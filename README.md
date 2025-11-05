# TryFit AI Backend 🔧

The powerful backend engine that drives TryFit AI's virtual try-on experience. Built with Node.js and Express, this server handles AI model processing, user authentication, and image management.

![TryFit AI Backend Architecture](https://github.com/fabortwell/Try-on-ai-fit/blob/main/src/images/home.png)
*Backend Architecture - Powering virtual try-on generation*

## 🚀 Features

### 🤖 AI Integration
- **Vella 1.5 AI Integration**: Seamless connection with advanced virtual try-on AI models
- **Batch Processing**: Efficient handling of multiple generation requests
- **Real-time Status**: Live progress tracking for generation tasks
- **Queue Management**: Intelligent request queuing and prioritization

### 🔐 Security & Authentication
- **JWT Authentication**: Secure user authentication with JSON Web Tokens
- **API Rate Limiting**: Protection against abuse and overload
- **CORS Configuration**: Secure cross-origin resource sharing
- **Input Validation**: Comprehensive request validation and sanitization

### 💾 Data Management
- **Image Processing**: Optimized handling of model and garment images
- **File Storage**: Efficient storage and retrieval of generated results
- **User Sessions**: Persistent session management
- **Request Logging**: Comprehensive logging for debugging and analytics

### 📊 API Features
- **RESTful Design**: Clean, predictable API endpoints
- **Error Handling**: Comprehensive error responses and status codes
- **Health Checks**: System monitoring and status endpoints
- **WebSocket Support**: Real-time updates for generation progress

## 🛠️ Tech Stack

### Core Technologies
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **JWT** - JSON Web Tokens for authentication
- **Multer** - File upload handling
- **CORS** - Cross-origin resource sharing

### AI & Processing
- **Python Integration** - AI model execution
- **Image Processing** - OpenCV/PIL for image manipulation
- **Queue System** - Request processing management
- **Vella 1.5 AI** - Virtual try-on generation engine

### Database & Storage
- **File System** - Image and result storage
- **Memory Store** - Session and cache management
- **Metadata Storage** - Generation request tracking

## 📁 Project Structure

```
tryfit-ai-backend/
├── src/
│   ├── controllers/          # Route controllers
│   │   ├── authController.js
│   │   ├── generateController.js
│   │   └── statusController.js
│   ├── middleware/           # Custom middleware
│   │   ├── auth.js
│   │   ├── validation.js
│   │   └── upload.js
│   ├── services/            # Business logic
│   │   ├── aiService.js
│   │   ├── userService.js
│   │   └── imageService.js
│   ├── utils/               # Helper functions
│   │   ├── fileHandler.js
│   │   ├── validators.js
│   │   └── constants.js
│   ├── routes/              # API routes
│   │   ├── auth.js
│   │   ├── generate.js
│   │   └── status.js
│   └── app.js              # Main application file
├── outputs/                 # Generated images storage
├── uploads/                 # Temporary upload storage
├── models/                  # AI model files
└── config/                  # Configuration files
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8+ (for AI model integration)
- Vella 1.5 AI model files
- Sufficient storage for image processing

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/tryfit-ai-backend.git
cd tryfit-ai-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
API_BASE_URL=http://localhost:5000
AI_MODEL_PATH=./models/vella-1.5
UPLOAD_DIR=./uploads
OUTPUT_DIR=./outputs
MAX_FILE_SIZE=10485760
CORS_ORIGIN=http://localhost:3000
```

### 4. AI Model Setup
```bash
# Place Vella 1.5 model files in the models directory
mkdir -p models/vella-1.5
# Add your AI model files to this directory
```

### 5. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📚 API Documentation

### Authentication Endpoints

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "123",
    "username": "johndoe",
    "email": "john@example.com",
    "token": "jwt-token-here"
  }
}
```

#### `POST /api/auth/login`
Authenticate user and return JWT token.

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "123",
    "username": "johndoe",
    "email": "john@example.com",
    "token": "jwt-token-here"
  }
}
```

### Generation Endpoints

#### `POST /api/generate`
Generate virtual try-on results.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Form Data:**
- `modelType`: "default" or "upload"
- `modelId`: (if modelType is "default")
- `modelImage`: (if modelType is "upload")
- `garmentType`: "single" or "multiple"
- `singleGarmentImage`: (if garmentType is "single")
- `topGarmentImage`: (if garmentType is "multiple")
- `bottomGarmentImage`: (if garmentType is "multiple")
- `outputCount`: number of results to generate
- `seed`: random seed for generation
- `garmentData`: JSON string with garment metadata

**Response:**
```json
{
  "success": true,
  "requestId": "req_123456789",
  "message": "Generation started successfully"
}
```

#### `GET /api/status/:requestId`
Check generation status and get results.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "status": "completed",
  "results": {
    "modelFront": "/outputs/model_front_123.jpg",
    "modelBack": "/outputs/model_back_123.jpg",
    "enhancedProduct": "/outputs/product_123.jpg",
    "tryonResult1": "/outputs/result1_123.jpg",
    "tryonResult2": "/outputs/result2_123.jpg"
  },
  "progress": 100
}
```

### System Endpoints

#### `GET /api/health`
Check server health and status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123456,
  "memoryUsage": {
    "rss": 123456789,
    "heapTotal": 12345678,
    "heapUsed": 1234567,
    "external": 123456
  }
}
```

## 🔒 Security Features

### Authentication Flow
1. User registers/login to get JWT token
2. Token included in Authorization header for protected routes
3. Middleware validates token on each request
4. Token expiration and refresh handling

### File Upload Security
- File type validation (images only)
- File size limits (10MB default)
- Malware scanning integration
- Secure temporary file handling

### Rate Limiting
- 100 requests per 15 minutes per user
- Burst protection for generation endpoints
- IP-based limiting for public endpoints

## 🚀 Deployment

### Production Setup

1. **Environment Setup**
   ```bash
   # Set production environment
   export NODE_ENV=production
   export JWT_SECRET=your-production-secret
   export PORT=5000
   ```

2. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start src/app.js --name "tryfit-ai-backend"
   pm2 startup
   pm2 save
   ```

3. **Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Docker Deployment
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Common Issues

1. **AI Model Not Loading**
   ```
   Error: AI model files not found in ./models/vella-1.5
   ```
   **Solution:** Ensure Vella 1.5 model files are properly placed in the models directory.

2. **Memory Issues**
   ```
   JavaScript heap out of memory
   ```
   **Solution:** Increase Node.js memory limit:
   ```bash
   node --max-old-space-size=4096 src/app.js
   ```

3. **File Upload Failures**
   ```
   MulterError: File too large
   ```
   **Solution:** Check file size limits and storage availability.

### Logging
The backend includes comprehensive logging:
- Request/response logging
- Error tracking
- Performance metrics
- Generation progress logs

## 📊 Monitoring & Analytics

### Health Metrics
- CPU and memory usage
- Active connections
- Queue length
- Generation success rate

### Performance Tracking
- Request response times
- Generation processing times
- Error rates and types
- User activity patterns

## 🤝 Contributing

We welcome contributions to the TryFit AI backend!

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Standards
- Follow Express.js best practices
- Use async/await for asynchronous operations
- Include proper error handling
- Write comprehensive API documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For technical support:
1. Check the troubleshooting section
2. Review API documentation
3. Create an issue on GitHub
4. Contact the development team
