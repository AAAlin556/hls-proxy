const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing url');

  try {
    const parsed = new URL(targetUrl);
    const basePath = parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1);
    const baseUrl = `${parsed.protocol}//${parsed.host}${basePath}`;
    const proxyBase = `${req.protocol}://${req.get('host')}/api/proxy?url=`;

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${parsed.protocol}//${parsed.host}/`,
        'Origin': `${parsed.protocol}//${parsed.host}`,
        'Accept': '*/*',
      }
    });

    const isM3U8 = targetUrl.includes('.m3u8');

    if (isM3U8) {
      let text = response.data.toString('utf8');

      text = text.replace(/^(?!#)(.+\.m3u8.*)$/gm, match => {
        match = match.trim();
        return match.startsWith('http')
          ? proxyBase + encodeURIComponent(match)
          : proxyBase + encodeURIComponent(baseUrl + match);
      });

      text = text.replace(/^(?!#)(.+\.ts.*)$/gm, match => {
        match = match.trim();
        return match.startsWith('http')
          ? proxyBase + encodeURIComponent(match)
          : proxyBase + encodeURIComponent(baseUrl + match);
      });

      text = text.replace(/URI="([^"]+)"/g, (_, uri) => {
        const full = uri.startsWith('http') ? uri : baseUrl + uri;
        return `URI="${proxyBase}${encodeURIComponent(full)}"`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(text);
    }

    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp2t');
    res.send(response.data);

  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
