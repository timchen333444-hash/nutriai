-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT 'maintain',
    "age" INTEGER,
    "sex" TEXT,
    "height" REAL,
    "weight" REAL,
    "activityLevel" TEXT NOT NULL DEFAULT 'sedentary',
    "dietaryRestrictions" TEXT NOT NULL DEFAULT '[]',
    "calorieTarget" REAL,
    "proteinTarget" REAL,
    "carbTarget" REAL,
    "fatTarget" REAL,
    "units" TEXT NOT NULL DEFAULT 'metric',
    "weightUnit" TEXT NOT NULL DEFAULT 'lbs',
    "heightUnit" TEXT NOT NULL DEFAULT 'ft',
    "waterUnit" TEXT NOT NULL DEFAULT 'floz',
    "energyUnit" TEXT NOT NULL DEFAULT 'kcal',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "firstDayOfWeek" TEXT NOT NULL DEFAULT 'sunday',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("activityLevel", "age", "calorieTarget", "carbTarget", "createdAt", "dietaryRestrictions", "email", "fatTarget", "goal", "height", "id", "name", "onboardingComplete", "password", "proteinTarget", "sex", "units", "weight") SELECT "activityLevel", "age", "calorieTarget", "carbTarget", "createdAt", "dietaryRestrictions", "email", "fatTarget", "goal", "height", "id", "name", "onboardingComplete", "password", "proteinTarget", "sex", "units", "weight" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
