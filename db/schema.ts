import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const socialConnections = sqliteTable('social_connections', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), platform: text('platform').notNull(),
  accountId: text('account_id').notNull(), handle: text('handle').notNull(), displayName: text('display_name'),
  status: text('status').notNull().default('connected'), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_connections_user_platform').on(table.userId, table.platform), uniqueIndex('idx_connections_platform_account').on(table.platform, table.accountId)]);

export const oauthStore = sqliteTable('oauth_store', {
  namespace: text('namespace').notNull(), key: text('key').notNull(), encryptedValue: text('encrypted_value').notNull(),
  expiresAt: integer('expires_at'), updatedAt: integer('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_oauth_store_namespace_key').on(table.namespace, table.key)]);

export const mediaAssets = sqliteTable('media_assets', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), objectKey: text('object_key').notNull(),
  filename: text('filename').notNull(), contentType: text('content_type').notNull(), sizeBytes: integer('size_bytes').notNull(),
  altText: text('alt_text'), createdAt: integer('created_at').notNull(),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), content: text('content').notNull(), linkUrl: text('link_url'),
  mediaId: text('media_id'), scheduledAt: integer('scheduled_at'), status: text('status').notNull().default('draft'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_posts_user_status_schedule').on(table.userId, table.status, table.scheduledAt),
  index('idx_posts_status_schedule').on(table.status, table.scheduledAt),
]);

export const postDeliveries = sqliteTable('post_deliveries', {
  id: text('id').primaryKey(), postId: text('post_id').notNull(), platform: text('platform').notNull(),
  status: text('status').notNull().default('queued'), externalId: text('external_id'), externalUrl: text('external_url'),
  errorMessage: text('error_message'), attempts: integer('attempts').notNull().default(0), publishedAt: integer('published_at'), updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_delivery_post_platform').on(table.postId, table.platform),
  index('idx_delivery_platform_status').on(table.platform, table.status),
]);
