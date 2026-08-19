CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`brand` text,
	`source` text NOT NULL,
	`source_id` text,
	`barcode` text,
	`serving_name` text,
	`serving_grams` real,
	`servings` text,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real,
	`sugar_g` real,
	`sat_fat_g` real,
	`mono_fat_g` real,
	`poly_fat_g` real,
	`trans_fat_g` real,
	`cholesterol_mg` real,
	`sodium_mg` real,
	`potassium_mg` real,
	`calcium_mg` real,
	`iron_mg` real,
	`magnesium_mg` real,
	`zinc_mg` real,
	`vitamin_a_ug` real,
	`vitamin_c_mg` real,
	`vitamin_d_ug` real,
	`vitamin_b12_ug` real,
	`folate_ug` real,
	`last_used_at` integer,
	`use_count` integer DEFAULT 0 NOT NULL,
	`is_favorite` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `foods_barcode_idx` ON `foods` (`barcode`);--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);--> statement-breakpoint
CREATE INDEX `foods_last_used_idx` ON `foods` (`last_used_at`);--> statement-breakpoint
CREATE TABLE `log_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`meal` text NOT NULL,
	`food_id` text,
	`name` text NOT NULL,
	`brand` text,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`grams` real,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`micros` text,
	`logged_via` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `log_entries_date_idx` ON `log_entries` (`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`onboarding_complete` integer DEFAULT 0 NOT NULL,
	`sex` text,
	`birth_year` integer,
	`height_cm` real,
	`activity_level` text,
	`goal_type` text,
	`goal_rate_pct_per_week` real,
	`protein_g_per_kg` real DEFAULT 1.8 NOT NULL,
	`weight_unit` text DEFAULT 'lb' NOT NULL,
	`initial_tdee` real,
	`last_checkin_date` text
);
--> statement-breakpoint
CREATE TABLE `targets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`effective_date` text NOT NULL,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`tdee_at_set` real,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `targets_effective_date_idx` ON `targets` (`effective_date`);--> statement-breakpoint
CREATE TABLE `weights` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weights_date_unique` ON `weights` (`date`);--> statement-breakpoint
CREATE INDEX `weights_date_idx` ON `weights` (`date`);