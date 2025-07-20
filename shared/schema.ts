import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leagues = pgTable("leagues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sport: text("sport").notNull(),
  season: text("season").notNull(),
  settings: text("settings"),
  status: text("status").notNull(),
  total_rosters: integer("total_rosters").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const drafts = pgTable("drafts", {
  id: text("id").primaryKey(),
  league_id: text("league_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  sport: text("sport").notNull(),
  season: text("season").notNull(),
  settings: text("settings"),
  start_time: timestamp("start_time"),
  created_at: timestamp("created_at").defaultNow(),
});

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  first_name: text("first_name"),
  last_name: text("last_name"),
  position: text("position"),
  team: text("team"),
  age: integer("age"),
  years_exp: integer("years_exp"),
  height: text("height"),
  weight: text("weight"),
  status: text("status"),
  injury_status: text("injury_status"),
  ktc_value: integer("ktc_value"),
  ktc_rank: integer("ktc_rank"),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const draft_picks = pgTable("draft_picks", {
  id: serial("id").primaryKey(),
  draft_id: text("draft_id").notNull(),
  player_id: text("player_id"),
  picked_by: text("picked_by"),
  roster_id: integer("roster_id"),
  round: integer("round").notNull(),
  pick_no: integer("pick_no").notNull(),
  is_keeper: boolean("is_keeper").default(false),
  metadata: text("metadata"),
  picked_at: timestamp("picked_at"),
});

export const mock_drafts = pgTable("mock_drafts", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  league_settings: text("league_settings").notNull(),
  draft_order: text("draft_order").notNull(),
  picks: text("picks").notNull(),
  current_pick: integer("current_pick").default(1),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const watchlists = pgTable("watchlists", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  player_id: text("player_id").notNull(),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  league_id: text("league_id").notNull(),
  draft_id: text("draft_id").notNull(),
  user_id: text("user_id").notNull(),
  league_name: text("league_name").notNull(),
  last_used: timestamp("last_used").defaultNow().notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const data_cache = pgTable("data_cache", {
  id: serial("id").primaryKey(),
  cache_key: text("cache_key").unique().notNull(),
  last_updated: timestamp("last_updated").defaultNow().notNull(),
  data_count: integer("data_count").default(0),
  status: text("status").default("active").notNull(), // active, updating, failed
  metadata: text("metadata"), // JSON string for additional info
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertLeagueSchema = createInsertSchema(leagues).omit({
  created_at: true,
});

export const insertDraftSchema = createInsertSchema(drafts).omit({
  created_at: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  updated_at: true,
});

export const insertDraftPickSchema = createInsertSchema(draft_picks).omit({
  id: true,
  picked_at: true,
});

export const insertMockDraftSchema = createInsertSchema(mock_drafts).omit({
  created_at: true,
  updated_at: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  created_at: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  created_at: true,
  last_used: true,
});

export const insertDataCacheSchema = createInsertSchema(data_cache).omit({
  id: true,
  created_at: true,
  last_updated: true,
});

export type League = typeof leagues.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type DraftPick = typeof draft_picks.$inferSelect;
export type InsertDraftPick = z.infer<typeof insertDraftPickSchema>;
export type MockDraft = typeof mock_drafts.$inferSelect;
export type InsertMockDraft = z.infer<typeof insertMockDraftSchema>;
export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type DataCache = typeof data_cache.$inferSelect;
export type InsertDataCache = z.infer<typeof insertDataCacheSchema>;
