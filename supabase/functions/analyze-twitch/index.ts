import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  timestamp: number;
  username: string;
  message: string;
}

interface ChatActivity {
  time: string;
  messages: number;
  timestamp: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, threshold = 80 } = await req.json();
    console.log('Analyzing Twitch VOD:', videoUrl);

    const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID');
    const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error('Twitch credentials not configured');
    }

    // Get OAuth token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Extract video ID or channel name from URL
    let videoId: string;
    const videoIdMatch = videoUrl.match(/videos\/(\d+)/);
    const channelMatch = videoUrl.match(/twitch\.tv\/([^\/\?]+)/);
    
    if (videoIdMatch) {
      // Direct VOD URL
      videoId = videoIdMatch[1];
    } else if (channelMatch) {
      // Channel URL - get latest VOD
      const channelName = channelMatch[1];
      console.log('Fetching latest VOD for channel:', channelName);
      
      const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${channelName}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      const userData = await userResponse.json();
      if (!userData.data || userData.data.length === 0) {
        throw new Error('Canal no encontrado');
      }
      
      const userId = userData.data[0].id;
      
      // Get latest VOD
      const videosResponse = await fetch(`https://api.twitch.tv/helix/videos?user_id=${userId}&first=1&type=archive`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      const videosData = await videosResponse.json();
      if (!videosData.data || videosData.data.length === 0) {
        throw new Error('No se encontraron VODs para este canal');
      }
      
      videoId = videosData.data[0].id;
      console.log('Latest VOD ID:', videoId);
    } else {
      throw new Error('URL inválida. Por favor ingresa una URL de Twitch válida (canal o VOD)');
    }

    // Get video info
    const videoResponse = await fetch(`https://api.twitch.tv/helix/videos?id=${videoId}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const videoData = await videoResponse.json();
    if (!videoData.data || videoData.data.length === 0) {
      throw new Error('Video not found');
    }

    const video = videoData.data[0];
    const duration = parseDuration(video.duration);
    
    // Simulate chat activity analysis
    // En producción, esto usaría la API de Twitch para obtener datos reales del chat
    const activityData = simulateChatActivity(duration, threshold);
    
    const clips = detectClips(activityData, threshold);

    return new Response(
      JSON.stringify({
        success: true,
        video: {
          id: videoId,
          title: video.title,
          duration: video.duration,
          thumbnail: video.thumbnail_url,
          url: video.url,
        },
        activityData,
        clips,
        stats: {
          totalMessages: activityData.reduce((sum, point) => sum + point.messages, 0),
          avgMessagesPerSecond: Math.round(
            activityData.reduce((sum, point) => sum + point.messages, 0) / activityData.length
          ),
          duration: video.duration,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error analyzing Twitch VOD:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseDuration(duration: string): number {
  // Parse Twitch duration format (e.g., "2h15m30s")
  let seconds = 0;
  const hours = duration.match(/(\d+)h/);
  const minutes = duration.match(/(\d+)m/);
  const secs = duration.match(/(\d+)s/);
  
  if (hours) seconds += parseInt(hours[1]) * 3600;
  if (minutes) seconds += parseInt(minutes[1]) * 60;
  if (secs) seconds += parseInt(secs[1]);
  
  return seconds;
}

function simulateChatActivity(durationSeconds: number, baselineThreshold: number): ChatActivity[] {
  const data: ChatActivity[] = [];
  const pointsCount = Math.min(100, Math.floor(durationSeconds / 30)); // Un punto cada 30 segundos
  
  for (let i = 0; i < pointsCount; i++) {
    const timeInSeconds = (i * durationSeconds) / pointsCount;
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    // Generar actividad con picos aleatorios
    const baseline = baselineThreshold * 0.4;
    const variance = Math.random() * baseline;
    let messages = baseline + variance;
    
    // 15% de probabilidad de pico
    if (Math.random() > 0.85) {
      messages = baselineThreshold + Math.random() * (baselineThreshold * 0.5);
    }
    
    data.push({
      time: `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
      messages: Math.round(messages),
      timestamp: timeInSeconds,
    });
  }
  
  return data;
}

function detectClips(activityData: ChatActivity[], threshold: number) {
  const clips = [];
  let clipId = 1;
  
  for (let i = 0; i < activityData.length; i++) {
    if (activityData[i].messages >= threshold) {
      const startTime = Math.max(0, activityData[i].timestamp - 15);
      
      clips.push({
        id: `clip-${clipId++}`,
        timestamp: activityData[i].time,
        timestampSeconds: activityData[i].timestamp,
        startTime,
        duration: 30,
        messageCount: activityData[i].messages,
        peakMessages: activityData[i].messages,
      });
    }
  }
  
  return clips;
}
