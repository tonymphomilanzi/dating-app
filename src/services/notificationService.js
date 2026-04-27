// src/services/notificationService.js
import { supabase } from '../lib/supabase.client';
import { NOTIFICATION_TYPES } from '../lib/notificationHelpers';

/**
 * Base function to create a notification
 */
async function createNotification({ userId, type, data = {} }) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      data,
      read: false,
    });

  if (error) {
    console.error('Error creating notification:', error);
    return { error };
  }

  return { success: true };
}

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTION NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export async function notifySubscriptionActivated(userId, planName) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_ACTIVATED,
    data: { planName },
  });
}

export async function notifySubscriptionUpgraded(userId, planName) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_UPGRADED,
    data: { planName },
  });
}

export async function notifySubscriptionExpiring(userId, planName, daysLeft) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING_SOON,
    data: { planName, daysLeft },
  });
}

export async function notifySubscriptionExpired(userId) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED,
    data: {},
  });
}

export async function notifySubscriptionRenewed(userId, planName, period) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_RENEWED,
    data: { planName, period },
  });
}

export async function notifyTrialStarted(userId, trialDays = 7) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.TRIAL_STARTED,
    data: { trialDays },
  });
}

export async function notifyTrialEnding(userId, daysLeft) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.TRIAL_ENDING_SOON,
    data: { daysLeft },
  });
}

export async function notifyFeatureUnlocked(userId, featureType) {
  const typeMap = {
    chat: NOTIFICATION_TYPES.FEATURE_UNLOCKED_CHAT,
    filters: NOTIFICATION_TYPES.FEATURE_UNLOCKED_ADVANCED_FILTERS,
    likes: NOTIFICATION_TYPES.FEATURE_UNLOCKED_UNLIMITED_LIKES,
    see_who_liked: NOTIFICATION_TYPES.FEATURE_UNLOCKED_SEE_WHO_LIKED,
  };

  return createNotification({
    userId,
    type: typeMap[featureType] || NOTIFICATION_TYPES.SUBSCRIPTION_ACTIVATED,
    data: {},
  });
}

export async function notifyFeatureLocked(userId, featureName) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.FEATURE_LOCKED,
    data: { featureName },
  });
}

// ══════════════════════════════════════════════════════════════
// ADMIN SUBSCRIPTION ACTIONS
// ══════════════════════════════════════════════════════════════

export async function notifySubscriptionGranted(userId, duration, reason) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_GRANTED,
    data: { duration, reason },
  });
}

export async function notifySubscriptionRevoked(userId, reason) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_REVOKED,
    data: { reason },
  });
}

export async function notifySubscriptionExtended(userId, duration, reason) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_EXTENDED,
    data: { duration, reason },
  });
}

// ══════════════════════════════════════════════════════════════
// PAYMENT NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export async function notifyPaymentFailed(userId) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.PAYMENT_FAILED,
    data: {},
  });
}

export async function notifyPaymentSuccessful(userId, amount) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL,
    data: { amount },
  });
}

// ══════════════════════════════════════════════════════════════
// ADMIN ANNOUNCEMENTS
// ══════════════════════════════════════════════════════════════

export async function notifyAdminAnnouncement(userId, title, message, action = null) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
    data: { title, message, action },
  });
}

export async function notifyMaintenanceScheduled(userId, date, message) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED,
    data: { date, message },
  });
}

// ══════════════════════════════════════════════════════════════
// APPROVAL NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export async function notifyClinicApproved(userId, clinicId, clinicName) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.CLINIC_APPROVED,
    data: { clinicId, clinicName },
  });
}

export async function notifyClinicRejected(userId, clinicId, clinicName, reason) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.CLINIC_REJECTED,
    data: { clinicId, clinicName, reason },
  });
}

export async function notifyProfileVerified(userId) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.PROFILE_VERIFIED,
    data: {},
  });
}

// ══════════════════════════════════════════════════════════════
// MATCH & LIKE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export async function notifyNewMatch(userId, matchId, userName) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.NEW_MATCH,
    data: { matchId, userName },
  });
}

export async function notifyProfileLike(userId, likerId, userName, isPremium) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.PROFILE_LIKE,
    data: { userId: likerId, userName, isPremium },
  });
}

export async function notifyNewMessage(userId, matchId, userName) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MATCH_MESSAGE,
    data: { matchId, userName },
  });
}