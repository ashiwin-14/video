export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, imageUrl, style = 'kling-1.0-pro' } = req.body;
    
    const IMAGINE_API_KEY = process.env.IMAGINE_API_KEY;
    
    if (!IMAGINE_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Convert base64 to blob
    const base64Data = imageUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    const formData = new FormData();
    formData.append('style', style);
    formData.append('prompt', prompt);
    formData.append('file', new Blob([buffer]), 'image.jpg');

    const response = await fetch('https://api.vyro.ai/v2/video/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IMAGINE_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.id) {
      const videoUrl = await pollForVideo(result.id, IMAGINE_API_KEY);
      return res.json({ success: true, video_url: videoUrl });
    }
    
    return res.json({ success: true, video_url: result.url || result.video_url });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function pollForVideo(taskId, apiKey) {
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const statusResponse = await fetch(`https://api.vyro.ai/v2/video/status/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.status === 'completed') {
          return status.video_url || status.url;
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }
  throw new Error('Video generation timeout');
}
