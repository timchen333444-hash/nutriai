const { google } = require('googleapis');
const prisma = require('../lib/prisma.js');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Sync the last 7 days of Google Fit data for a user.
 * Returns { synced: number } or throws on auth error.
 */
async function syncGoogleFit(userId) {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: 'google_fit' } },
  });

  if (!integration?.isConnected) return { synced: 0, connected: false };

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token:  integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date:   integration.tokenExpiry?.getTime() ?? undefined,
  });

  // Persist refreshed tokens automatically
  oauth2Client.on('tokens', async (tokens) => {
    const patch = { accessToken: tokens.access_token };
    if (tokens.expiry_date) patch.tokenExpiry = new Date(tokens.expiry_date);
    await prisma.userIntegration.update({
      where: { userId_provider: { userId, provider: 'google_fit' } },
      data: patch,
    }).catch(() => {});
  });

  const now         = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

  const response = await fitness.users.dataset.aggregate({
    userId: 'me',
    requestBody: {
      aggregateBy: [
        { dataTypeName: 'com.google.step_count.delta' },
        { dataTypeName: 'com.google.calories.expended' },
        { dataTypeName: 'com.google.active_minutes' },
        { dataTypeName: 'com.google.distance.delta' },
        { dataTypeName: 'com.google.heart_rate.bpm' },
      ],
      bucketByTime: { durationMillis: String(24 * 60 * 60 * 1000) },
      startTimeMillis: String(now - sevenDaysMs),
      endTimeMillis:   String(now),
    },
  });

  const buckets = response.data.bucket || [];
  let synced = 0;

  for (const bucket of buckets) {
    const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().slice(0, 10);

    let steps = 0, caloriesBurned = 0, activeMinutes = 0, distanceKm = 0, heartRateAvg = null;

    for (const ds of bucket.dataset || []) {
      const srcId = ds.dataSourceId || '';
      for (const point of ds.point || []) {
        const vals = point.value || [];
        if (srcId.includes('step_count'))       steps          += vals[0]?.intVal  || 0;
        else if (srcId.includes('calories'))    caloriesBurned += vals[0]?.fpVal   || 0;
        else if (srcId.includes('active_min'))  activeMinutes  += vals[0]?.intVal  || 0;
        else if (srcId.includes('distance'))    distanceKm     += (vals[0]?.fpVal  || 0) / 1000;
        else if (srcId.includes('heart_rate'))  heartRateAvg    = vals[2]?.fpVal   ?? null; // index 2 = avg
      }
    }

    if (steps > 0 || caloriesBurned > 0) {
      await prisma.fitnessLog.upsert({
        where:  { userId_date: { userId, date } },
        create: {
          userId,
          date,
          steps,
          caloriesBurned: Math.round(caloriesBurned),
          activeMinutes,
          distanceKm:   Math.round(distanceKm * 100) / 100,
          heartRateAvg: heartRateAvg ? Math.round(heartRateAvg) : null,
          source: 'google_fit',
        },
        update: {
          steps,
          caloriesBurned: Math.round(caloriesBurned),
          activeMinutes,
          distanceKm:   Math.round(distanceKm * 100) / 100,
          heartRateAvg: heartRateAvg ? Math.round(heartRateAvg) : null,
          source: 'google_fit',
        },
      });
      synced++;
    }
  }

  await prisma.userIntegration.update({
    where: { userId_provider: { userId, provider: 'google_fit' } },
    data:  { lastSyncedAt: new Date() },
  });

  return { synced, connected: true };
}

module.exports = { syncGoogleFit };
