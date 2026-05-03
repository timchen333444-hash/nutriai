const prisma = require('../lib/prisma.js');

const CONFIGS = {
  plan:    { field: 'aiPlansUsedThisMonth',    limit: 3 },
  photo:   { field: 'aiPhotosUsedThisMonth',   limit: 5 },
  insight: { field: 'aiInsightsUsedThisMonth', limit: 4 },
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function resetDate(periodStart) {
  return new Date(new Date(periodStart).getTime() + THIRTY_DAYS_MS);
}

function friendlyReset(periodStart) {
  return resetDate(periodStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function limitMessage(type, limit, periodStart) {
  const date = friendlyReset(periodStart);
  if (type === 'plan')    return `You have used all ${limit} free AI meal plans this month. Your limit resets on ${date}.`;
  if (type === 'photo')   return `You have used all ${limit} free photo scans this month. Your limit resets on ${date}.`;
  return `You have used all ${limit} free AI insights this month. Your limit resets on ${date}.`;
}

module.exports = function usageLimit(type) {
  const config = CONFIGS[type];
  if (!config) throw new Error(`Unknown usage type: ${type}`);

  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (user.isPremium) return next();

      const now = new Date();
      const needsReset = !user.usagePeriodStart ||
        (now - new Date(user.usagePeriodStart)) > THIRTY_DAYS_MS;

      if (needsReset) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            aiPlansUsedThisMonth:    0,
            aiPhotosUsedThisMonth:   0,
            aiInsightsUsedThisMonth: 0,
            usagePeriodStart:        now,
          },
        });
        // After reset, counter is 0 — increment and proceed
        await prisma.user.update({
          where: { id: userId },
          data: { [config.field]: { increment: 1 } },
        });
        return next();
      }

      const used = user[config.field] ?? 0;
      if (used >= config.limit) {
        return res.status(429).json({
          error:     limitMessage(type, config.limit, user.usagePeriodStart),
          limitType: type,
          used,
          limit:     config.limit,
          resetsAt:  resetDate(user.usagePeriodStart).toISOString(),
        });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { [config.field]: { increment: 1 } },
      });

      next();
    } catch (e) {
      // Don't block the request if the usage check fails — log and continue
      console.error('[usageLimit] error:', e.message);
      next();
    }
  };
};
