import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const generations = pgTable('generations', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: text('session_id').notNull(),
  format: text('format').notNull(),
  promptPresent: boolean('prompt_present').notNull().default(false),
  logoPresent: boolean('logo_present').notNull().default(false),
  style: text('style').notNull().default('classic'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
