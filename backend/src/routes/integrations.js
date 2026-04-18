/**
 * Google OAuth 2.0 setup instructions:
 *  1. Go to https://console.cloud.google.com
 *  2. Create a project → APIs & Services → Library → enable "Fitness API"
 *  3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs
 *  4. Application type: Web application
 *  5. Authorized redirect URI: http://localhost:3001/api/integrations/google/callback
 *  6. Copy the Client ID and Client Secret to your .env file
 */
const { Router } = require('express');
const { google } = require('googleapis');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');
const { syncGoogleFit } = require('../services/googleFitSync.js');

const router = Router();

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.body.read',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

// GET /api/integrations/google/auth
// Redirects the user to the Google consent screen
router.get('/google/auth', authMiddleware, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: 'Google Fit integration not configured. Add GOOGLE_CLIENT_ID to .env.' });
  }
  const url = getOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    scope:       SCOPES,
    state:       String(req.user.id),
    prompt:      'consent',
  });
  res.redirect(url);
});

// GET /api/integrations/google/callback
// Called by Google after the user grants permission
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    return res.redirect(`${frontendUrl}/profile?fitness_error=${encodeURIComponent(error)}`);
  }

  const userId = parseInt(state, 10);
  if (!userId || !code) {
    return res.redirect(`${frontendUrl}/profile?fitness_error=invalid_callback`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens }   = await oauth2Client.getToken(code);

    await prisma.userIntegration.upsert({
      where:  { userId_provider: { userId, provider: 'google_fit' } },
      create: {
        userId,
        provider:     'google_fit',
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isConnected:  true,
      },
      update: {
        accessToken:  tokens.access_token,
        // Only overwrite refresh token if a new one was issued
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        tokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isConnected:  true,
      },
    });

    res.redirect(`${frontendUrl}/profile?fitness_connected=google`);
  } catch (e) {
    console.error('[Google callback]', e.message);
    res.redirect(`${frontendUrl}/profile?fitness_error=${encodeURIComponent(e.message)}`);
  }
});

// GET /api/integrations/google/sync
router.get('/google/sync', authMiddleware, async (req, res) => {
  try {
    const result = await syncGoogleFit(req.user.id);
    if (!result.connected) {
      return res.status(400).json({ error: 'Google Fit not connected' });
    }
    res.json(result);
  } catch (e) {
    console.error('[Google Fit sync]', e.message);
    if (e.code === 401 || e.message?.includes('invalid_grant') || e.message?.includes('Token has been expired')) {
      await prisma.userIntegration.update({
        where: { userId_provider: { userId: req.user.id, provider: 'google_fit' } },
        data:  { isConnected: false },
      }).catch(() => {});
      return res.status(401).json({ error: 'Google Fit connection expired. Please reconnect.' });
    }
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/integrations/google/disconnect
router.delete('/google/disconnect', authMiddleware, async (req, res) => {
  try {
    await prisma.userIntegration.update({
      where: { userId_provider: { userId: req.user.id, provider: 'google_fit' } },
      data:  { isConnected: false, accessToken: null, refreshToken: null },
    });
  } catch {
    // No integration row exists — that's fine
  }
  res.json({ success: true });
});

// GET /api/integrations/status
// Returns connection status for all providers
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const rows = await prisma.userIntegration.findMany({
      where:  { userId: req.user.id },
      select: { provider: true, isConnected: true, lastSyncedAt: true },
    });
    const result = {};
    for (const r of rows) result[r.provider] = { isConnected: r.isConnected, lastSyncedAt: r.lastSyncedAt };
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
