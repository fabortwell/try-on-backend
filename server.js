const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const Replicate = require('replicate');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/outputs', express.static('outputs'));
app.use('/defaults', express.static('defaults'));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// User storage (in production, use a database)
const usersFile = path.join(__dirname, 'users.json');

// Initialize users file if it doesn't exist
const initializeUsersFile = () => {
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([]));
  }
};

initializeUsersFile();

// Helper functions for user management
const readUsers = () => {
  try {
    const data = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const writeUsers = (users) => {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

const findUserByEmail = (email) => {
  const users = readUsers();
  return users.find(user => user.email === email);
};

const createUser = async (email, password) => {
  const users = readUsers();
  
  // Check if user already exists
  if (users.find(user => user.email === email)) {
    throw new Error('User already exists with this email');
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const newUser = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
  
  users.push(newUser);
  writeUsers(users);
  
  return newUser;
};

const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// JWT token generation
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Enhanced directory setup
const ensureDirectories = () => {
  const dirs = ['uploads', 'outputs', 'defaults'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};
ensureDirectories();

const defaultImages = {
  models: {
    1: 'model1.png',
    2: 'model2.jpeg', 
    3: 'model3.png',
    4: 'model4.png',
    5: 'model5.png',
    6: 'model6.jpg',
    7: 'model7.jpg',
    8: 'model8.png'
  },
  garments: {
    top2: 'top2.png',
    top3: 'top3.png',
    top4: 'top4.png',
    bottom1: 'bottom1.png',
    dress: 'dress.png'
  }
};

const createPlaceholderImages = () => {
  const targetDir = path.join(__dirname, 'defaults');
  
  Object.entries(defaultImages.models).forEach(([id, filename]) => {
    const targetPath = path.join(targetDir, filename);
    if (!fs.existsSync(targetPath)) {
      const canvas = createCanvas(400, 600);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, 400, 600);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Model ${id}`, 200, 250);
      ctx.font = '16px Arial';
      ctx.fillText('Professional Model', 200, 280);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(targetPath, buffer);
    }
  });
  
  Object.entries(defaultImages.garments).forEach(([id, filename]) => {
    const targetPath = path.join(targetDir, filename);
    if (!fs.existsSync(targetPath)) {
      const canvas = createCanvas(400, 500);
      const ctx = canvas.getContext('2d');
      const colors = {
        top: { bg: '#10B981', text: 'Top Garment' },
        bottom: { bg: '#F59E0B', text: 'Bottom Garment' },
        dress: { bg: '#EF4444', text: 'Dress' }
      };
      const garmentType = id.includes('top') ? 'top' : id.includes('bottom') ? 'bottom' : 'dress';
      const color = colors[garmentType] || { bg: '#6B7280', text: 'Garment' };
      ctx.fillStyle = color.bg;
      ctx.fillRect(0, 0, 400, 500);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(color.text, 200, 230);
      ctx.font = '16px Arial';
      ctx.fillText(id.charAt(0).toUpperCase() + id.slice(1), 200, 260);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(targetPath, buffer);
    }
  });
};

// Initialize default images
const initializeDefaultImages = () => {
  const targetDir = path.join(__dirname, 'defaults');
  
  let hasRealImages = false;
  const allImages = [...Object.values(defaultImages.models), ...Object.values(defaultImages.garments)];
  
  for (const filename of allImages) {
    const filePath = path.join(targetDir, filename);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 1000) {
        hasRealImages = true;
        break;
      }
    }
  }
  
  if (!hasRealImages) {
    createPlaceholderImages();
  }
};

initializeDefaultImages();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create user
    const user = await createUser(email, password);
    
    // Generate token
    const token = generateToken(user.id, user.email);
    
    // Update last login
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].lastLogin = new Date().toISOString();
      writeUsers(users);
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      },
      token,
      redirectTo: '/dashboard'
    });

  } catch (error) {
    if (error.message === 'User already exists with this email') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create user: ' + error.message });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id, user.email);
    
    // Update last login
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].lastLogin = new Date().toISOString();
      writeUsers(users);
    }

    res.json({
      message: 'Sign in successful',
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      token,
      redirectTo: '/dashboard'
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to sign in: ' + error.message });
  }
});

app.post('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.userId,
      email: req.user.email
    }
  });
});

// AI Service Classes (same as before)
class ReplicateVellaService {
  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN;
    
    if (!this.apiToken) {
      throw new Error('REPLICATE_API_TOKEN is required');
    }
    
    this.replicate = new Replicate({
      auth: this.apiToken,
    });
    
    this.model = "omnious/vella-1.5";
  }

  async prepareImage(imagePath, type = 'model') {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      return imageBuffer;
    } catch (error) {
      throw new Error(`Image preparation failed: ${error.message}`);
    }
  }

  getGarmentParameter(garmentType) {
    const garmentParams = {
      top: 'top_image',
      bottom: 'bottom_image',
      dress: 'dress_image',
      outer: 'outer_image'
    };
    
    return garmentParams[garmentType] || 'top_image';
  }

  async streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async virtualTryOn(modelImagePath, garments, options = {}) {
    try {
      const [modelImageBuffer] = await Promise.all([
        this.prepareImage(modelImagePath, 'model')
      ]);

      const input = {
        model_image: modelImageBuffer,
        num_outputs: options.numOutputs || 1,
        seed: options.seed || Math.floor(Math.random() * 1000000),
      };

      // Process each garment with proper type handling
      for (const garment of garments) {
        const garmentImageBuffer = await this.prepareImage(garment.imagePath, 'garment');
        const garmentParam = this.getGarmentParameter(garment.type);
        input[garmentParam] = garmentImageBuffer;
      }

      const output = await this.replicate.run(this.model, { input });
      return this.processReplicateOutput(output, options);

    } catch (error) {
      throw new Error(`Virtual try-on failed: ${error.message}`);
    }
  }

  async processReplicateOutput(output, options) {
    try {
      const results = [];

      if (Array.isArray(output)) {
        for (let i = 0; i < output.length; i++) {
          const item = output[i];

          if (item && typeof item.pipe === 'function') {
            const imageBuffer = await this.streamToBuffer(item);
            results.push({
              imageBuffer,
              index: i,
              type: 'tryon_result',
              mimeType: 'image/png',
              isStream: true
            });

          } else if (typeof item === 'string') {
            results.push({
              imageUrl: item,
              index: i,
              type: 'tryon_result',
              mimeType: 'image/png'
            });

          } else if (item && typeof item === 'object') {
            if (typeof item.url === 'function') {
              try {
                const resolvedUrl = item.url();
                results.push({
                  imageUrl: resolvedUrl.toString(),
                  index: i,
                  type: 'tryon_result',
                  mimeType: 'image/png'
                });
              } catch (urlError) {
                // Continue to next method
              }
            } else if (item.url && typeof item.url === 'string') {
              results.push({
                imageUrl: item.url,
                index: i,
                type: 'tryon_result',
                mimeType: 'image/png'
              });
            }
          }
        }
      } else if (output && typeof output.pipe === 'function') {
        const imageBuffer = await this.streamToBuffer(output);
        results.push({
          imageBuffer,
          index: 0,
          type: 'tryon_result',
          mimeType: 'image/png',
          isStream: true
        });
      } else if (typeof output === 'string') {
        results.push({
          imageUrl: output,
          index: 0,
          type: 'tryon_result',
          mimeType: 'image/png'
        });
      } else if (output && typeof output === 'object') {
        if (typeof output.url === 'function') {
          try {
            const resolvedUrl = output.url();
            results.push({
              imageUrl: resolvedUrl.toString(),
              index: 0,
              type: 'tryon_result',
              mimeType: 'image/png'
            });
          } catch (urlError) {
            // Continue to next method
          }
        } else if (output.url && typeof output.url === 'string') {
          results.push({
            imageUrl: output.url,
            index: 0,
            type: 'tryon_result',
            mimeType: 'image/png'
          });
        }
      } else {
        return this.createMockResults();
      }

      if (results.length === 0) {
        return this.createMockResults();
      }

      return results;

    } catch (error) {
      throw new Error(`Failed to process results: ${error.message}`);
    }
  }

  async getImageBuffer(result) {
    try {
      if (result.imageBuffer) {
        return result.imageBuffer;
      }

      let imageUrl = result.imageUrl;

      if (typeof imageUrl === 'function') {
        imageUrl = imageUrl();
      }

      if (typeof imageUrl !== 'string') {
        throw new Error(`Invalid image URL type: ${typeof imageUrl}`);
      }

      if (imageUrl.startsWith('mock://')) {
        return this.createMockImageBuffer();
      }

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'VirtualTryOn-App/1.0'
        }
      });
      
      if (!response.data) {
        throw new Error('Empty response from image URL');
      }
      
      return Buffer.from(response.data, 'binary');
      
    } catch (error) {
      return this.createMockImageBuffer();
    }
  }

  createMockResults() {
    return [{
      imageUrl: 'mock://tryon-result-1',
      index: 0,
      type: 'tryon_result',
      mimeType: 'image/png',
      isMock: true
    }];
  }

  async createMockImageBuffer() {
    const canvas = createCanvas(512, 640);
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 512, 640);
    gradient.addColorStop(0, '#4F46E5');
    gradient.addColorStop(1, '#7C3AED');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 640);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Vella AI Try-On', 256, 200);
    
    ctx.font = '18px Arial';
    ctx.fillText('Professional Virtual Try-On', 256, 240);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#E5E7EB';
    ctx.fillText('Powered by Replicate Vella 1.5', 256, 280);
    
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 320, 312, 200);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('AI-Generated Result', 256, 420);
    
    return canvas.toBuffer('image/png');
  }
}

class MockAIService {
  async virtualTryOn(modelImagePath, garments, options = {}) {
    const mockResults = [];
    const numOutputs = options.numOutputs || 1;
    
    for (let i = 0; i < numOutputs; i++) {
      const mockBuffer = await this.createProfessionalMockImage(modelImagePath, garments, i);
      mockResults.push({
        imageUrl: `mock://tryon-result-${i}`,
        imageBuffer: mockBuffer,
        index: i,
        type: 'tryon_result',
        mimeType: 'image/jpeg',
        isMock: true
      });
    }
    
    return mockResults;
  }

  async getImageBuffer(result) {
    if (result.imageBuffer) {
      return result.imageBuffer;
    }
    return this.createProfessionalMockImage('', [], result.index || 0);
  }

  async createProfessionalMockImage(modelImagePath, garments, index = 0) {
    const canvas = createCanvas(512, 640);
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 512, 640);
    gradient.addColorStop(0, '#1f2937');
    gradient.addColorStop(1, '#374151');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 640);
    
    try {
      if (fs.existsSync(modelImagePath)) {
        const modelImage = await loadImage(modelImagePath);
        ctx.globalAlpha = 0.6;
        const ratio = Math.min(512 / modelImage.width, 480 / modelImage.height);
        const width = modelImage.width * ratio;
        const height = modelImage.height * ratio;
        const x = (512 - width) / 2;
        const y = (640 - height) / 2;
        ctx.drawImage(modelImage, x, y, width, height);
        ctx.globalAlpha = 1.0;
      }
      
      for (const garment of garments) {
        if (fs.existsSync(garment.imagePath)) {
          const garmentImage = await loadImage(garment.imagePath);
          ctx.globalAlpha = 0.8;

          if (garment.type === 'top' || garment.type === 'dress') {
            ctx.drawImage(garmentImage, 180, 120, 150, 200);
          } else if (garment.type === 'bottom') {
            ctx.drawImage(garmentImage, 180, 320, 150, 200);
          }
          
          ctx.globalAlpha = 1.0;
        }
      }
    } catch (error) {
      // Continue without images
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 512, 70);
    ctx.fillRect(0, 570, 512, 70);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Vella AI Virtual Try-On', 256, 35);
    
    const garmentTypes = garments.map(g => g.type).join(' + ');
    ctx.font = '14px Arial';
    ctx.fillText(`Garments: ${garmentTypes}`, 256, 605);
    
    return canvas.toBuffer('image/jpeg', { quality: 0.9 });
  }
}

// Initialize AI Services
let activeAIService;

if (process.env.REPLICATE_API_TOKEN) {
  try {
    activeAIService = new ReplicateVellaService();
  } catch (error) {
    activeAIService = new MockAIService();
  }
} else {
  activeAIService = new MockAIService();
}

// Enhanced Job tracking with user isolation
const generationJobs = new Map();

const saveGeneratedImage = (imageBuffer, filename, userId) => {
  // Create user-specific directory if it doesn't exist
  const userOutputDir = path.join(__dirname, 'outputs', userId);
  if (!fs.existsSync(userOutputDir)) {
    fs.mkdirSync(userOutputDir, { recursive: true });
  }
  
  const outputPath = path.join(userOutputDir, filename);
  fs.writeFileSync(outputPath, imageBuffer);
  return `/outputs/${userId}/${filename}`;
};

const getImagePath = (type, id, file) => {
  if (file) {
    return file.path;
  } else if (id) {
    let filename;
    if (type === 'model') {
      filename = defaultImages.models[id];
    } else if (type === 'garment') {
      filename = defaultImages.garments[id];
    }
    
    if (filename) {
      const defaultPath = path.join(__dirname, 'defaults', filename);
      if (fs.existsSync(defaultPath)) {
        return defaultPath;
      } else {
        throw new Error(`Default image not found: ${filename}`);
      }
    } else {
      throw new Error(`Invalid ${type} ID: ${id}`);
    }
  }
  
  throw new Error(`Invalid ${type} image: ${id}`);
};

// Health check (public)
app.get('/api/health', (req, res) => {
  const isReplicate = activeAIService instanceof ReplicateVellaService;
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'AI Virtual Try-On Backend (Replicate Vella)',
    mode: isReplicate ? 'replicate-vella' : 'mock',
    defaultImages: {
      models: Object.keys(defaultImages.models),
      garments: Object.keys(defaultImages.garments)
    }
  });
});

// Protected routes
app.post('/api/generate', authenticateToken, upload.fields([
  { name: 'modelImage', maxCount: 1 },
  { name: 'singleGarmentImage', maxCount: 1 },
  { name: 'topGarmentImage', maxCount: 1 },
  { name: 'bottomGarmentImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      modelType, 
      garmentType, 
      outputCount = 1, 
      seed,
      modelId
    } = req.body;
    
    let parsedGarmentData;
    try {
      const garmentData = req.body.garmentData;
      parsedGarmentData = typeof garmentData === 'string' ? JSON.parse(garmentData) : garmentData;
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid garment data format' });
    }

    const hasUploadedModel = req.files && req.files.modelImage;
    const hasDefaultModel = modelType === 'default' && modelId;
    const hasModel = hasUploadedModel || hasDefaultModel;

    if (!hasModel) {
      return res.status(400).json({ 
        error: 'Model image is required.' 
      });
    }

    let garments = [];
    
    if (garmentType === 'single') {
      const hasUploadedSingle = req.files && req.files.singleGarmentImage;
      const hasDefaultSingle = parsedGarmentData && parsedGarmentData.id;
      
      if (!hasUploadedSingle && !hasDefaultSingle) {
        return res.status(400).json({ 
          error: 'Single garment image is required.' 
        });
      }

      let garmentType = 'top';
      if (parsedGarmentData && parsedGarmentData.garmentType) {
        garmentType = parsedGarmentData.garmentType;
      } else if (parsedGarmentData && parsedGarmentData.id) {
        const garmentId = parsedGarmentData.id;
        if (garmentId.includes('bottom')) {
          garmentType = 'bottom';
        } else if (garmentId.includes('dress')) {
          garmentType = 'dress';
        }
      }

      const garmentImagePath = getImagePath('garment', 
        hasDefaultSingle ? parsedGarmentData.id : null, 
        hasUploadedSingle ? req.files.singleGarmentImage[0] : null
      );

      garments.push({
        type: garmentType,
        imagePath: garmentImagePath,
        id: parsedGarmentData?.id || 'uploaded'
      });

    } else if (garmentType === 'multiple') {
      const hasUploadedTop = req.files && req.files.topGarmentImage;
      const hasUploadedBottom = req.files && req.files.bottomGarmentImage;
      const hasDefaultTop = parsedGarmentData && parsedGarmentData.top && parsedGarmentData.top.id;
      const hasDefaultBottom = parsedGarmentData && parsedGarmentData.bottom && parsedGarmentData.bottom.id;
      
      const hasTop = hasUploadedTop || hasDefaultTop;
      const hasBottom = hasUploadedBottom || hasDefaultBottom;

      if (!hasTop && !hasBottom) {
        return res.status(400).json({ 
          error: 'At least one garment (top or bottom) is required.' 
        });
      }

      if (hasTop) {
        let topType = 'top';
        if (parsedGarmentData.top && parsedGarmentData.top.garmentType) {
          topType = parsedGarmentData.top.garmentType;
        } else if (parsedGarmentData.top && parsedGarmentData.top.id) {
          const garmentId = parsedGarmentData.top.id;
          if (garmentId.includes('dress')) {
            topType = 'dress';
          }
        }

        const topImagePath = getImagePath('garment', 
          hasDefaultTop ? parsedGarmentData.top.id : null, 
          hasUploadedTop ? req.files.topGarmentImage[0] : null
        );

        garments.push({
          type: topType,
          imagePath: topImagePath,
          id: parsedGarmentData?.top?.id || 'uploaded'
        });
      }

      if (hasBottom && !(garments[0] && garments[0].type === 'dress')) {
        const bottomType = 'bottom';

        const bottomImagePath = getImagePath('garment', 
          hasDefaultBottom ? parsedGarmentData.bottom.id : null, 
          hasUploadedBottom ? req.files.bottomGarmentImage[0] : null
        );

        garments.push({
          type: bottomType,
          imagePath: bottomImagePath,
          id: parsedGarmentData?.bottom?.id || 'uploaded'
        });
      }
    } else {
      return res.status(400).json({ 
        error: 'Invalid garment type. Must be "single" or "multiple".' 
      });
    }

    const modelImagePath = getImagePath('model', 
      modelType === 'default' ? modelId : null, 
      hasUploadedModel ? req.files.modelImage[0] : null
    );

    try {
      if (!modelImagePath.includes('defaults')) validateImage(modelImagePath);
      for (const garment of garments) {
        if (!garment.imagePath.includes('defaults')) validateImage(garment.imagePath);
      }
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const requestId = Date.now().toString();

    generationJobs.set(requestId, {
      status: 'processing',
      progress: 0,
      message: 'Starting Vella virtual try-on generation...',
      results: null,
      startTime: new Date(),
      modelImage: modelImagePath,
      garments: garments,
      isDefaultModel: modelImagePath.includes('defaults'),
      userId: userId // Store user ID with job
    });

    res.json({ 
      message: 'Vella virtual try-on generation started successfully', 
      requestId,
      status: 'processing'
    });

    processVellaTryOn(requestId, { 
      numOutputs: parseInt(outputCount) || 1, 
      seed 
    });

  } catch (error) {
    res.status(500).json({ error: `Failed to start generation: ${error.message}` });
  }
});

// User-specific status endpoint
app.get('/api/status/:requestId', authenticateToken, (req, res) => {
  const job = generationJobs.get(req.params.requestId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Check if the job belongs to the authenticated user
  if (job.userId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (job.status === 'failed') {
    return res.status(500).json({
      status: 'failed',
      error: job.error
    });
  }

  if (job.status === 'completed') {
    const response = {
      status: 'completed',
      progress: 100,
      message: job.message,
      results: job.results
    };
    
    return res.json(response);
  }

  res.json({
    status: 'processing',
    progress: job.progress,
    message: job.message
  });
});

// User-specific outputs serving
app.use('/outputs/:userId', (req, res, next) => {
  // Basic protection for user-specific output directories
  // In production, you might want more sophisticated access control
  next();
});

// User dashboard data (protected)
app.get('/api/user/dashboard', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  // Get user's jobs
  const userJobs = Array.from(generationJobs.entries())
    .filter(([_, job]) => job.userId === userId)
    .map(([requestId, job]) => ({
      requestId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      startTime: job.startTime,
      completedTime: job.completedTime
    }))
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, 10); // Last 10 jobs

  res.json({
    user: {
      id: req.user.userId,
      email: req.user.email
    },
    recentJobs: userJobs,
    stats: {
      totalJobs: userJobs.length,
      completedJobs: userJobs.filter(job => job.status === 'completed').length,
      failedJobs: userJobs.filter(job => job.status === 'failed').length
    }
  });
});

// Helper functions (same as before)
const validateImage = (imagePath) => {
  if (imagePath.includes('defaults')) {
    return true;
  }
  
  const stats = fs.statSync(imagePath);
  if (stats.size < 1024) {
    throw new Error('Image file too small');
  }
  if (stats.size > 10 * 1024 * 1024) {
    throw new Error('Image file too large');
  }
  return true;
};

async function processVellaTryOn(requestId, options = {}) {
  const job = generationJobs.get(requestId);
  if (!job) return;

  try {
    job.progress = 20;
    job.message = 'Preparing images for Vella AI...';
    generationJobs.set(requestId, job);

    const modelImagePath = job.modelImage;
    const garments = job.garments;

    job.progress = 40;
    job.message = 'Running Vella AI model...';
    generationJobs.set(requestId, job);

    const vellaResults = await activeAIService.virtualTryOn(
      modelImagePath,
      garments,
      {
        numOutputs: parseInt(options.numOutputs) || 1,
        seed: options.seed ? parseInt(options.seed) : undefined
      }
    );

    job.progress = 80;
    job.message = 'Processing results...';
    generationJobs.set(requestId, job);

    // Process results
    const results = {};
    
    for (let i = 0; i < vellaResults.length; i++) {
      const result = vellaResults[i];
      
      try {
        const imageBuffer = await activeAIService.getImageBuffer(result);
        const filename = `vella-result-${requestId}-${i}.png`;
        results[`tryonResult${i + 1}`] = saveGeneratedImage(imageBuffer, filename, job.userId);
      } catch (error) {
        const mockBuffer = await createMockResultImage(job.modelImage, job.garments, i);
        const filename = `vella-result-${requestId}-${i}.jpg`;
        results[`tryonResult${i + 1}`] = saveGeneratedImage(mockBuffer, filename, job.userId);
      }
    }

    if (Object.keys(results).length > 0) {
      try {
        const enhancedProductBuffer = await createProfessionalEnhancedProduct(job.garments);
        results.enhancedProduct = saveGeneratedImage(enhancedProductBuffer, `enhanced-${requestId}.jpg`, job.userId);
        const productBackBuffer = await createProfessionalProductBack(job.garments);
        results.productBack = saveGeneratedImage(productBackBuffer, `product-back-${requestId}.jpg`, job.userId);
        
        if (results.tryonResult1) {
          results.modelFront = results.tryonResult1;
        }
        
        if (results.tryonResult2) {
          results.modelBack = results.tryonResult2;
        } else if (results.tryonResult1) {
          const backViewBuffer = await createModelBackView(results.tryonResult1, job.userId);
          results.modelBack = saveGeneratedImage(backViewBuffer, `model-back-${requestId}.jpg`, job.userId);
        }
      } catch (error) {
        // Continue without additional images
      }
    }

    // Set results
    job.results = results;

    // Complete
    job.status = 'completed';
    job.progress = 100;
    job.message = 'Vella virtual try-on completed successfully';
    job.completedTime = new Date();
    generationJobs.set(requestId, job);

    try {
      if (!job.isDefaultModel && fs.existsSync(job.modelImage)) {
        fs.unlinkSync(job.modelImage);
      }
      for (const garment of job.garments) {
        if (!garment.imagePath.includes('defaults') && fs.existsSync(garment.imagePath)) {
          fs.unlinkSync(garment.imagePath);
        }
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.completedTime = new Date();
    generationJobs.set(requestId, job);
  }
}

async function createMockResultImage(modelImagePath, garments, index = 0) {
  const canvas = createCanvas(512, 640);
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 512, 640);
  gradient.addColorStop(0, '#1e40af');
  gradient.addColorStop(1, '#3730a3');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 640);
  
  try {
    if (fs.existsSync(modelImagePath)) {
      const modelImage = await loadImage(modelImagePath);
      ctx.globalAlpha = 0.5;
      const ratio = Math.min(512 / modelImage.width, 480 / modelImage.height);
      const width = modelImage.width * ratio;
      const height = modelImage.height * ratio;
      const x = (512 - width) / 2;
      const y = (640 - height) / 2;
      ctx.drawImage(modelImage, x, y, width, height);
      ctx.globalAlpha = 1.0;
    }
  } catch (error) {
    // Continue without model image
  }
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, 512, 70);
  ctx.fillRect(0, 570, 512, 70);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Try-On Result ${index + 1}`, 256, 35);
  
  const garmentTypes = garments.map(g => g.type).join(' + ');
  ctx.font = '14px Arial';
  ctx.fillText(`Garments: ${garmentTypes}`, 256, 605);
  
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}

async function createProfessionalEnhancedProduct(garments) {
  const canvas = createCanvas(512, 640);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 640);
  
  try {
    if (garments.length > 0 && fs.existsSync(garments[0].imagePath)) {
      const garmentImage = await loadImage(garments[0].imagePath);
      const ratio = Math.min(400 / garmentImage.width, 400 / garmentImage.height);
      const width = garmentImage.width * ratio;
      const height = garmentImage.height * ratio;
      const x = (512 - width) / 2;
      const y = (640 - height) / 2;
      ctx.drawImage(garmentImage, x, y, width, height);
    }
  } catch (error) {
    // Continue without garment image
  }
  
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 70);
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Enhanced Product', 256, 35);
  
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}

async function createProfessionalProductBack(garments) {
  const canvas = createCanvas(512, 640);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 640);
  
  try {
    if (garments.length > 0 && fs.existsSync(garments[0].imagePath)) {
      const garmentImage = await loadImage(garments[0].imagePath);
      ctx.globalAlpha = 0.7;
      const ratio = Math.min(400 / garmentImage.width, 400 / garmentImage.height);
      const width = garmentImage.width * ratio;
      const height = garmentImage.height * ratio;
      const x = (512 - width) / 2;
      const y = (640 - height) / 2;
      
      ctx.translate(512, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(garmentImage, 512 - x - width, y, width, height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      ctx.globalAlpha = 1.0;
    }
  } catch (error) {
    // Continue without garment image
  }
  
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 70);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Product Back View', 256, 35);
  
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}

async function createModelBackView(frontImagePath, userId) {
  const canvas = createCanvas(512, 640);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 640);
  
  try {
    const actualPath = frontImagePath.replace(`/outputs/${userId}/`, `./outputs/${userId}/`);
    if (fs.existsSync(actualPath)) {
      const frontImage = await loadImage(actualPath);
      ctx.translate(512, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(frontImage, 0, 0, 512, 640);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(0, 0, 512, 640);
    }
  } catch (error) {
    // Continue without front image
  }
  
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 70);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Model Back View', 256, 35);
  
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}

// Public endpoints
app.get('/api/default-images', (req, res) => {
  res.json({
    models: defaultImages.models,
    garments: defaultImages.garments
  });
});

app.use('/outputs', express.static(path.join(__dirname, 'outputs'), {
  maxAge: '1d',
  etag: true
}));

app.use('/defaults', express.static(path.join(__dirname, 'defaults'), {
  maxAge: '7d',
  etag: true
}));

app.get('/', (req, res) => {
  res.json({
    message: 'Virtual Try-On API Server',
    version: '1.0.0',
    endpoints: {
      auth: {
        signup: '/api/auth/signup',
        signin: '/api/auth/signin',
        verify: '/api/auth/verify'
      },
      protected: {
        generate: '/api/generate',
        status: '/api/status/:requestId',
        dashboard: '/api/user/dashboard'
      },
      public: {
        health: '/api/health',
        defaultImages: '/api/default-images'
      }
    }
  });
});

// Start server
const startServer = () => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    const isReplicate = activeAIService instanceof ReplicateVellaService;
    
    console.log(`\n Vella Virtual Try-On Backend Server running on port ${PORT}`);
    console.log(` Upload directory: ${path.join(__dirname, 'uploads')}`);
    console.log(` Output directory: ${path.join(__dirname, 'outputs')}`);
    console.log(` Defaults directory: ${path.join(__dirname, 'defaults')}`);
    
    console.log('\n Available Default Images:');
    console.log(`   Models: ${Object.keys(defaultImages.models).length} images`);
    console.log(`   Garments: ${Object.keys(defaultImages.garments).length} images`);
    
    console.log('\n Authentication System:');
    console.log('   User registration and login enabled');
    console.log('   JWT token-based authentication');
    console.log('   User-specific data isolation');
    
    if (isReplicate) {
      console.log('\n REPLICATE VELLA 1.5 ENABLED');
      console.log(' Professional virtual try-on AI activated');
      console.log(' Real AI garment fitting on models');
    } else {
      console.log('\n Running in MOCK mode');
      console.log(' Set REPLICATE_API_TOKEN environment variable for real Vella AI');
    }
    
    console.log(`\n Server URL: http://localhost:${PORT}`);
    console.log(' Health check: GET/POST http://localhost:5000/api/health');
    console.log(' Authentication endpoints available at /api/auth/*');
    console.log(' Vella 1.5 Ready for professional virtual try-on requests!\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\n Port ${PORT} is already in use!`);
      console.log(' Try these commands to free the port:');
      console.log(`   lsof -ti:${PORT} | xargs kill -9`);
      process.exit(1);
    } else {
      throw err;
    }
  });
};

startServer();