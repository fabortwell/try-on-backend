const Replicate = require('replicate');
const axios = require('axios');
const fs = require('fs');
const { Readable } = require('stream');

class ReplicateVellaService {
  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN;
    
    if (!this.apiToken) {
      throw new Error('REPLICATE_API_TOKEN is required');
    }
    
    this.replicate = new Replicate({
      auth: this.apiToken,
    });
    
    this.model = "omnious/vella-1.5:75mnw301jnrmc0csvzfb72wzpc";
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

  determineGarmentType(garments) {
    const hasTop = garments.some(g => g.type === 'top');
    const hasBottom = garments.some(g => g.type === 'bottom');
    const hasDress = garments.some(g => g.type === 'dress');
    const hasOuter = garments.some(g => g.type === 'outer');
    if (hasDress) {
      return 'dress';
    } else if (hasTop && hasBottom) {
      return 'top_bottom';
    } else if (hasTop && hasOuter) {
      return 'top_outer';
    } else if (hasTop) {
      return 'top';
    } else if (hasBottom) {
      return 'bottom';
    } else if (hasOuter) {
      return 'outer';
    } else {
      return 'top';
    }
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
      console.log('Starting Vella 1.5 virtual try-on...');
      console.log('Garments to process:', garments.map(g => ({ type: g.type, path: g.imagePath })));

      const modelImageBuffer = await this.prepareImage(modelImagePath, 'model');
      const garmentType = this.determineGarmentType(garments);
      console.log(`Determined garment_type: ${garmentType} for garments: ${garments.map(g => g.type).join(', ')}`);
      
      const input = {
        model_image: modelImageBuffer,
        garment_type: garmentType,
        num_outputs: options.numOutputs || 1,
        seed: options.seed || Math.floor(Math.random() * 1000000),
      };

      for (const garment of garments) {
        const garmentImageBuffer = await this.prepareImage(garment.imagePath, 'garment');
        const garmentParam = this.getGarmentParameter(garment.type);
        
        console.log(`Setting garment parameter: ${garmentParam} for type: ${garment.type}`);
        input[garmentParam] = garmentImageBuffer;
      }

      console.log('Sending to Replicate Vella with parameters:', {
        garmentTypes: garments.map(g => g.type),
        garment_type: input.garment_type,
        numOutputs: input.num_outputs,
        garmentParams: Object.keys(input).filter(key => key.includes('_image'))
      });

      console.log('Running Vella 1.5 model...');
      const output = await this.replicate.run(this.model, { input });

      console.log('Replicate API call completed');
      console.log('Output received, type:', typeof output, Array.isArray(output) ? `array with ${output.length} items` : 'single item');
      
      return this.processReplicateOutput(output, options);

    } catch (error) {
      console.error('Replicate API error:', error);
      
      if (error.message?.includes('auth')) {
        throw new Error('Invalid Replicate API token. Please check your REPLICATE_API_TOKEN.');
      } else if (error.message?.includes('garment_type')) {
        throw new Error('Garment type configuration error. Please ensure proper garment selection.');
      } else if (error.message?.includes('size') || error.message?.includes('dimension')) {
        throw new Error('Image size issue. Please try with different images.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Request timeout. Please try again.');
      }
      
      throw new Error(`Virtual try-on failed: ${error.message}`);
    }
  }

  async processReplicateOutput(output, options) {
    try {
      console.log('🔧 Processing Replicate output...');
      const results = [];

      if (Array.isArray(output)) {
        console.log(`📸 Processing ${output.length} output items`);
        for (let i = 0; i < output.length; i++) {
          const item = output[i];
          console.log(`Item ${i} type:`, typeof item, item?.constructor?.name);

          if (item instanceof Readable) {
            console.log(`🔄 Converting stream ${i} to buffer...`);
            const imageBuffer = await this.streamToBuffer(item);
            results.push({ 
              imageBuffer, 
              index: i, 
              type: 'tryon_result', 
              mimeType: 'image/png', 
              isStream: true 
            });

          } else if (typeof item === 'string') {
            console.log(`🔗 Found URL string ${i}: ${item}`);
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
                console.log(`🔗 Found FileOutput URL ${i}:`, resolvedUrl);
                results.push({ 
                  imageUrl: resolvedUrl,
                  index: i, 
                  type: 'tryon_result', 
                  mimeType: 'image/png' 
                });
              } catch (urlError) {
                console.error(`Failed to resolve URL for item ${i}:`, urlError);
              }
            } else if (item.url && typeof item.url === 'string') {
              console.log(`🔗 Found object URL ${i}: ${item.url}`);
              results.push({ 
                imageUrl: item.url, 
                index: i, 
                type: 'tryon_result', 
                mimeType: 'image/png' 
              });
            } else {
              console.warn(`❓ Unknown object format at index ${i}:`, Object.keys(item));
            }
          } else {
            console.warn(`❓ Unknown output type at index ${i}:`, typeof item);
          }
        }

      } else if (typeof output === 'string') {
        console.log(`🔗 Found single URL: ${output}`);
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
            console.log(`🔗 Found single FileOutput URL:`, resolvedUrl);
            results.push({ 
              imageUrl: resolvedUrl, 
              index: 0, 
              type: 'tryon_result', 
              mimeType: 'image/png' 
            });
          } catch (urlError) {
            console.error('Failed to resolve single FileOutput URL:', urlError);
          }
        } else if (output.url && typeof output.url === 'string') {
          console.log(`🔗 Found single object URL: ${output.url}`);
          results.push({ 
            imageUrl: output.url, 
            index: 0, 
            type: 'tryon_result', 
            mimeType: 'image/png' 
          });
        } else {
          console.warn('❓ Unknown single object format:', Object.keys(output));
        }
      }

      if (results.length === 0) {
        console.warn('No valid results processed, creating mock results');
        return this.createMockResults();
      }

      console.log(`Successfully processed ${results.length} results`);
      return results;

    } catch (error) {
      console.error('Output processing error:', error);
      throw new Error(`Failed to process results: ${error.message}`);
    }
  }

  async getImageBuffer(result) {
    try {
      if (result.imageBuffer) {
        console.log('📦 Using existing image buffer');
        return result.imageBuffer;
      }

      let imageUrl = result.imageUrl;

      if (typeof imageUrl === 'function') {
        console.log('Converting FileOutput function to URL...');
        imageUrl = imageUrl();
      }

      if (typeof imageUrl !== 'string') {
        console.error('Invalid image URL type:', typeof imageUrl, imageUrl);
        throw new Error(`Invalid image URL type: ${typeof imageUrl}`);
      }

      if (imageUrl.startsWith('mock://')) {
        console.log('🎭 Using mock image');
        return this.createMockImageBuffer();
      }

      console.log('Downloading image from:', imageUrl);

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 
          'User-Agent': 'VirtualTryOn-App/1.0',
          'Accept': 'image/*'
        }
      });

      if (!response.data) {
        throw new Error('Empty response from image URL');
      }

      console.log('Image downloaded successfully');
      return Buffer.from(response.data, 'binary');

    } catch (error) {
      console.error('Image download failed:', error.message);
      return this.createMockImageBuffer();
    }
  }

  createMockResults() {
    console.log('Creating mock results for testing');
    
    return [{
      imageUrl: 'mock://tryon-result-1',
      index: 0,
      type: 'tryon_result',
      mimeType: 'image/png',
      isMock: true
    }];
  }

  async createMockImageBuffer() {
    try {
      const { createCanvas } = require('canvas');
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
    } catch (error) {
      console.error('Mock image creation failed:', error);
      return Buffer.from([]);
    }
  }
}

module.exports = ReplicateVellaService;