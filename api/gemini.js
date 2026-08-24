module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ nhận POST request' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'Chưa cài GEMINI_API_KEY hoặc OPENAI_API_KEY trên Vercel.'
    });
  }

  const body = req.body || {};
  const promptText = typeof body.prompt === 'string' && body.prompt.trim()
    ? body.prompt.trim()
    : 'Xin chào';
  const systemInstruction = typeof body.systemInstruction === 'string'
    ? body.systemInstruction.trim()
    : '';
  const image = body.image && typeof body.image === 'object' ? body.image : null;
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function isRetryable(status, message = '') {
    const text = String(message).toLowerCase();
    return [408, 409, 429, 500, 502, 503, 504].includes(Number(status)) ||
      text.includes('rate limit') ||
      text.includes('temporarily') ||
      text.includes('overloaded') ||
      text.includes('overload') ||
      text.includes('high demand') ||
      text.includes('resource exhausted') ||
      text.includes('timeout');
  }

  function safeHistory() {
    return history
      .filter(item => item && typeof item.text === 'string' && item.text.trim())
      .map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user',
        text: item.text.trim()
      }));
  }

  // ============================================================
  // 1) OPENAI PRIMARY
  // ============================================================
  async function callOpenAI() {
    if (!OPENAI_API_KEY) throw Object.assign(new Error('OPENAI_API_KEY chưa được cấu hình.'), { code: 'NO_OPENAI_KEY' });

    const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
    const input = [];

    for (const item of safeHistory()) {
      input.push({
        role: item.role,
        content: [{ type: 'input_text', text: item.text }]
      });
    }

    const currentContent = [{ type: 'input_text', text: promptText }];

    if (image && typeof image.data === 'string' && image.data.trim()) {
      const mimeType = typeof image.mimeType === 'string' && image.mimeType
        ? image.mimeType
        : 'image/jpeg';
      currentContent.push({
        type: 'input_image',
        image_url: `data:${mimeType};base64,${image.data}`
      });
    }

    input.push({ role: 'user', content: currentContent });

    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model,
            instructions: systemInstruction || undefined,
            input
          }),
          signal: controller.signal
        });

        const raw = await response.text();
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { error: { message: raw || `HTTP ${response.status}` } };
        }

        if (!response.ok) {
          const message = data?.error?.message || `OpenAI API HTTP ${response.status}`;
          const error = new Error(message);
          error.status = response.status;
          error.retryable = isRetryable(response.status, message);
          throw error;
        }

        const answer = typeof data.output_text === 'string' ? data.output_text.trim() : '';
        if (!answer) {
          const error = new Error('OpenAI không trả về nội dung.');
          error.status = 502;
          error.retryable = false;
          throw error;
        }

        return { answer, model };
      } catch (error) {
        if (error?.name === 'AbortError') {
          lastError = Object.assign(new Error('OpenAI phản hồi quá lâu.'), {
            status: 504,
            retryable: true
          });
        } else {
          lastError = error;
        }

        if (lastError.retryable && attempt === 0) {
          await sleep(900);
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error('Không thể gọi OpenAI.');
  }

  // ============================================================
  // 2) GEMINI FALLBACK
  // Giữ nguyên cơ chế Gemini đang chạy trước đây.
  // ============================================================
  async function callGemini() {
    if (!GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY chưa được cấu hình.'), { code: 'NO_GEMINI_KEY' });

    const contents = [];
    for (const item of safeHistory()) {
      contents.push({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.text }]
      });
    }

    const currentParts = [];
    if (systemInstruction) currentParts.push({ text: systemInstruction });
    currentParts.push({ text: promptText });

    if (image && typeof image.data === 'string' && image.data.trim()) {
      currentParts.push({
        inlineData: {
          mimeType: typeof image.mimeType === 'string' && image.mimeType
            ? image.mimeType
            : 'image/jpeg',
          data: image.data
        }
      });
    }

    contents.push({ role: 'user', parts: currentParts });

    const models = [
      'gemini-flash-latest',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite'
    ];

    let lastError = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
            signal: controller.signal
          });

          const raw = await response.text();
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { error: { message: raw || `HTTP ${response.status}` } };
          }

          const message = data?.error?.message || '';

          if (!response.ok) {
            const error = new Error(message || `Gemini API HTTP ${response.status}`);
            error.status = response.status;
            error.retryable = isRetryable(response.status, message);
            throw error;
          }

          const candidate = data?.candidates?.[0];
          const answer = (candidate?.content?.parts || [])
            .map(part => typeof part?.text === 'string' ? part.text : '')
            .join('')
            .trim();

          if (!answer) {
            const reason = candidate?.finishReason || data?.promptFeedback?.blockReason || 'UNKNOWN';
            const error = new Error(`Gemini không trả về nội dung (reason: ${reason}).`);
            error.status = 502;
            error.retryable = false;
            throw error;
          }

          return { answer, model };
        } catch (error) {
          if (error?.name === 'AbortError') {
            lastError = Object.assign(new Error('Gemini phản hồi quá lâu.'), {
              status: 504,
              retryable: true
            });
          } else {
            lastError = error;
          }

          if (lastError.retryable && attempt === 0) {
            await sleep(900);
            continue;
          }

          break;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      console.error(`[Gemini fallback] ${model}:`, lastError?.message || 'unknown');

      // Sai key / request / permission: không thử model khác.
      if (lastError && [400, 401, 403].includes(Number(lastError.status))) break;
    }

    throw lastError || new Error('Không thể gọi Gemini.');
  }

  // ============================================================
  // ROUTER: GPT trước -> Gemini fallback
  // ============================================================
  try {
    if (OPENAI_API_KEY) {
      try {
        const result = await callOpenAI();
        return res.status(200).json({ text: result.answer, model: result.model, provider: 'openai' });
      } catch (openaiError) {
        console.error('[OpenAI primary]', openaiError?.message || openaiError);
      }
    }

    if (GEMINI_API_KEY) {
      try {
        const result = await callGemini();
        return res.status(200).json({ text: result.answer, model: result.model, provider: 'gemini', fallback: true });
      } catch (geminiError) {
        console.error('[Gemini fallback]', geminiError?.message || geminiError);
        return res.status(502).json({
          error: 'Cả OpenAI và Gemini đều không thể trả lời lúc này.',
          details: geminiError?.message || 'Unknown error',
          retryable: !!geminiError?.retryable
        });
      }
    }

    return res.status(500).json({ error: 'Chưa cấu hình API cho AI.' });
  } catch (error) {
    console.error('[AI router]', error);
    return res.status(500).json({ error: 'Lỗi hệ thống: ' + (error?.message || 'Unknown error') });
  }
};
