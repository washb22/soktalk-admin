// api/send-push-all.js
export default async function handler(req, res) {
  // CORS 헤더
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
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages 배열이 필요합니다.' });
    }

    // Expo Push API로 발송
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    // 성공/실패 카운트
    let successCount = 0;
    let failureCount = 0;

    if (result.data) {
      result.data.forEach(item => {
        if (item.status === 'ok') {
          successCount++;
        } else {
          failureCount++;
        }
      });
    }

    return res.status(200).json({
      success: true,
      successCount,
      failureCount,
      data: result.data
    });

  } catch (error) {
    console.error('푸시 발송 에러:', error);
    return res.status(500).json({ 
      error: '푸시 발송 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
}