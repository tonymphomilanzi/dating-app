// src/lib/notificationHelpers.js

export const NOTIFICATION_TYPES = {
  // ══════════════════════════════════════════════════════════════
  // MATCHES & DATING
  // ══════════════════════════════════════════════════════════════
  NEW_MATCH: 'new_match',
  MATCH_MESSAGE: 'match_message',
  MATCH_EXPIRED: 'match_expired',
  
  // ══════════════════════════════════════════════════════════════
  // LIKES & ENGAGEMENT
  // ══════════════════════════════════════════════════════════════
  PROFILE_LIKE: 'profile_like',
  CLINIC_REVIEW: 'clinic_review',
  REVIEW_REPLY: 'review_reply',
  
  // ══════════════════════════════════════════════════════════════
  // PREMIUM SUBSCRIPTIONS (Admin Controlled)
  // ══════════════════════════════════════════════════════════════
  
  // Activation & Purchases
  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription_downgraded',
  
  // Renewals
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  SUBSCRIPTION_RENEWAL_FAILED: 'subscription_renewal_failed',
  
  // Expirations & Warnings
  SUBSCRIPTION_EXPIRING_SOON: 'subscription_expiring_soon',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  
  // Trials
  TRIAL_STARTED: 'trial_started',
  TRIAL_ENDING_SOON: 'trial_ending_soon',
  TRIAL_ENDED: 'trial_ended',
  
  // Feature Unlocks
  FEATURE_UNLOCKED_CHAT: 'feature_unlocked_chat',
  FEATURE_UNLOCKED_ADVANCED_FILTERS: 'feature_unlocked_advanced_filters',
  FEATURE_UNLOCKED_UNLIMITED_LIKES: 'feature_unlocked_unlimited_likes',
  FEATURE_UNLOCKED_SEE_WHO_LIKED: 'feature_unlocked_see_who_liked',
  FEATURE_LOCKED: 'feature_locked',
  
  // Payment Issues
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_METHOD_EXPIRING: 'payment_method_expiring',
  PAYMENT_SUCCESSFUL: 'payment_successful',
  
  // Admin Actions
  SUBSCRIPTION_GRANTED: 'subscription_granted',
  SUBSCRIPTION_REVOKED: 'subscription_revoked',
  SUBSCRIPTION_EXTENDED: 'subscription_extended',
  
  // ══════════════════════════════════════════════════════════════
  // ADMIN UPDATES & ANNOUNCEMENTS
  // ══════════════════════════════════════════════════════════════
  ADMIN_ANNOUNCEMENT: 'admin_announcement',
  SYSTEM_UPDATE: 'system_update',
  MAINTENANCE_SCHEDULED: 'maintenance_scheduled',
  NEW_FEATURE_AVAILABLE: 'new_feature_available',
  
  // ══════════════════════════════════════════════════════════════
  // APPROVALS & MODERATION
  // ══════════════════════════════════════════════════════════════
  CLINIC_APPROVED: 'clinic_approved',
  CLINIC_REJECTED: 'clinic_rejected',
  CLINIC_PENDING: 'clinic_pending',
  CLINIC_SUSPENDED: 'clinic_suspended',
  
  PROFILE_VERIFIED: 'profile_verified',
  PROFILE_VERIFICATION_REJECTED: 'profile_verification_rejected',
  
  CONTENT_FLAGGED: 'content_flagged',
  CONTENT_REMOVED: 'content_removed',
  ACCOUNT_WARNING: 'account_warning',
  ACCOUNT_SUSPENDED: 'account_suspended',
};

/**
 * Generate personalized notification messages
 * @param {string} type - Notification type
 * @param {object} data - Notification data (user names, plan names, etc.)
 * @returns {object} { title, message, icon, color, action }
 */
export function getNotificationContent(type, data = {}) {
  const templates = {
    // ══════════════════════════════════════════════════════════════
    // MATCHES & DATING
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.NEW_MATCH]: {
      title: 'New Match! 🎉',
      message: `You and ${data.userName || 'someone'} matched!`,
      icon: 'heart',
      color: 'pink',
      action: `/matches/${data.matchId}`,
    },
    [NOTIFICATION_TYPES.MATCH_MESSAGE]: {
      title: 'New Message',
      message: `${data.userName || 'Someone'} sent you a message`,
      icon: 'message',
      color: 'blue',
      action: `/messages/${data.matchId}`,
    },
    [NOTIFICATION_TYPES.MATCH_EXPIRED]: {
      title: 'Match Expired',
      message: `Your match with ${data.userName || 'someone'} has expired`,
      icon: 'clock',
      color: 'gray',
      action: null,
    },

    // ══════════════════════════════════════════════════════════════
    // LIKES & ENGAGEMENT
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.PROFILE_LIKE]: {
      title: 'Someone likes you! 💜',
      message: `${data.userName || 'Someone'} liked your profile`,
      icon: 'heart',
      color: 'purple',
      action: data.isPremium ? `/profile/${data.userId}` : '/subscription',
    },
    [NOTIFICATION_TYPES.CLINIC_REVIEW]: {
      title: 'New Review',
      message: `${data.userName || 'Someone'} reviewed ${data.clinicName || 'your clinic'}`,
      icon: 'star',
      color: 'amber',
      action: `/massage-clinics/${data.clinicId}`,
    },
    [NOTIFICATION_TYPES.REVIEW_REPLY]: {
      title: 'Review Reply',
      message: `${data.clinicName || 'A clinic'} replied to your review`,
      icon: 'message',
      color: 'blue',
      action: `/massage-clinics/${data.clinicId}`,
    },

    // ══════════════════════════════════════════════════════════════
    // PREMIUM SUBSCRIPTIONS - Activation & Purchases
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.SUBSCRIPTION_ACTIVATED]: {
      title: '✨ Welcome to Premium!',
      message: `Your ${data.planName || 'Premium'} subscription is now active. Enjoy unlimited chats and exclusive features!`,
      icon: 'sparkles',
      color: 'violet',
      action: '/account/subscription',
    },
    [NOTIFICATION_TYPES.SUBSCRIPTION_UPGRADED]: {
      title: '🚀 Subscription Upgraded!',
      message: `You've upgraded to ${data.planName || 'Premium'}! New features unlocked.`,
      icon: 'arrow-up',
      color: 'green',
      action: '/account/subscription',
    },
    [NOTIFICATION_TYPES.SUBSCRIPTION_DOWNGRADED]: {
      title: 'Subscription Changed',
      message: `Your plan has been changed to ${data.planName || 'Basic'}`,
      icon: 'arrow-down',
      color: 'orange',
      action: '/account/subscription',
    },

    // ══════════════════════════════════════════════════════════════
    // PREMIUM SUBSCRIPTIONS - Renewals
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.SUBSCRIPTION_RENEWED]: {
      title: '✅ Subscription Renewed',
      message: `Your ${data.planName || 'Premium'} subscription has been renewed for another ${data.period || 'month'}`,
      icon: 'check-circle',
      color: 'green',
      action: '/account/subscription',
    },
    [NOTIFICATION_TYPES.SUBSCRIPTION_RENEWAL_FAILED]: {
      title: '⚠️ Renewal Failed',
      message: `We couldn't renew your subscription. Please update your payment method.`,
      icon: 'alert',
      color: 'red',
      action: '/account/billing',
    },

    // ══════════════════════════════════════════════════════════════
    // PREMIUM SUBSCRIPTIONS - Expirations & Warnings
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING_SOON]: {
      title: '⏰ Subscription Expiring',
      message: `Your ${data.planName || 'Premium'} subscription expires in ${data.daysLeft || '3'} days`,
      icon: 'clock',
      color: 'orange',
      action: '/account/subscription',
    },
    [NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED]: {
      title: 'Subscription Expired',
      message: 'Your premium features have been paused. Renew to continue chatting and accessing exclusive features.',
      icon: 'x-circle',
      color: 'red',
      action: '/subscription',
    },
    [NOTIFICATION_TYPES.SUBSCRIPTION_CANCELLED]: {
      title: 'Subscription Cancelled',
      message: `Your subscription has been cancelled. You'll have access until ${data.expiresAt || 'the end of your billing period'}.`,
      icon: 'info',
      color: 'gray',
      action: '/account/subscription',
    },

    // ══════════════════════════════════════════════════════════════
    // PREMIUM SUBSCRIPTIONS - Trials
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.TRIAL_STARTED]: {
      title: '🎁 Free Trial Started!',
      message: `Enjoy ${data.trialDays || '7'} days of Premium features for free!`,
      icon: 'gift',
      color: 'violet',
      action: '/discover',
    },
    [NOTIFICATION_TYPES.TRIAL_ENDING_SOON]: {
      title: 'Trial Ending Soon',
      message: `Your free trial ends in ${data.daysLeft || '2'} days. Subscribe to keep your premium features!`,
      icon: 'clock',
      color: 'orange',
      action: '/subscription',
    },
    [NOTIFICATION_TYPES.TRIAL_ENDED]: {
      title: 'Trial Ended',
      message: 'Your free trial has ended. Subscribe now to continue enjoying premium features!',
      icon: 'info',
      color: 'blue',
      action: '/subscription',
    },

    // ══════════════════════════════════════════════════════════════
    // FEATURE UNLOCKS
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.FEATURE_UNLOCKED_CHAT]: {
      title: '💬 Chat Unlocked!',
      message: 'You can now send unlimited messages to your matches!',
      icon: 'message',
      color: 'blue',
      action: '/messages',
    },
    [NOTIFICATION_TYPES.FEATURE_UNLOCKED_ADVANCED_FILTERS]: {
      title: '🔍 Advanced Filters Unlocked!',
      message: 'Find your perfect match with advanced search filters',
      icon: 'filter',
      color: 'purple',
      action: '/discover',
    },
    [NOTIFICATION_TYPES.FEATURE_UNLOCKED_UNLIMITED_LIKES]: {
      title: '❤️ Unlimited Likes!',
      message: 'Like as many profiles as you want - no limits!',
      icon: 'heart',
      color: 'pink',
      action: '/discover',
    },
    [NOTIFICATION_TYPES.FEATURE_UNLOCKED_SEE_WHO_LIKED]: {
      title: '👀 See Who Liked You!',
      message: 'Check out everyone who liked your profile',
      icon: 'eye',
      color: 'violet',
      action: '/likes',
    },
    [NOTIFICATION_TYPES.FEATURE_LOCKED]: {
      title: '🔒 Feature Locked',
      message: `${data.featureName || 'This feature'} is now locked. Upgrade to Premium to unlock it again.`,
      icon: 'lock',
      color: 'gray',
      action: '/subscription',
    },

    // ══════════════════════════════════════════════════════════════
    // PAYMENT ISSUES
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.PAYMENT_FAILED]: {
      title: '❌ Payment Failed',
      message: 'Your payment couldn\'t be processed. Please update your payment method.',
      icon: 'alert',
      color: 'red',
      action: '/account/billing',
    },
    [NOTIFICATION_TYPES.PAYMENT_METHOD_EXPIRING]: {
      title: 'Payment Method Expiring',
      message: `Your payment method ending in ${data.last4 || '****'} expires soon. Please update it.`,
      icon: 'credit-card',
      color: 'orange',
      action: '/account/billing',
    },
    [NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL]: {
      title: '✅ Payment Successful',
      message: `Your payment of $${data.amount || '0.00'} was processed successfully`,
      icon: 'check-circle',
      color: 'green',
      action: '/account/billing',
    },

    // ══════════════════════════════════════════════════════════════
    // ADMIN SUBSCRIPTION ACTIONS
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.SUBSCRIPTION_GRANTED]: {
      title: '🎁 Free Premium Access!',
      message: `You've been granted ${data.duration || 'premium access'} by our team! ${data.reason || 'Enjoy!'}`,
      icon: 'gift',
      color: 'green',
      action: '/account/subscription',
    },
    [NOTIFICATION_TYPES.SUBSCRIPTION_REVOKED]: {
      title: 'Subscription Revoked',
      message: data.reason || 'Your subscription has been revoked. Please contact support for details.',
      icon: 'x-circle',
      color: 'red',
      action: '/support',
    },
    [NOTIFICATION_TYPES.SUBSCRIPTION_EXTENDED]: {
      title: '🎉 Subscription Extended!',
      message: `Your subscription has been extended by ${data.duration || 'our team'}. ${data.reason || 'Enjoy!'}`,
      icon: 'gift',
      color: 'violet',
      action: '/account/subscription',
    },

    // ══════════════════════════════════════════════════════════════
    // ADMIN UPDATES & ANNOUNCEMENTS
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT]: {
      title: data.title || '📣 Important Update',
      message: data.message || 'Check out the latest updates from our team',
      icon: 'megaphone',
      color: 'indigo',
      action: data.action || null,
    },
    [NOTIFICATION_TYPES.SYSTEM_UPDATE]: {
      title: 'App Updated',
      message: data.message || 'New features and improvements are available!',
      icon: 'sparkles',
      color: 'violet',
      action: data.action || null,
    },
    [NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED]: {
      title: '🔧 Maintenance Scheduled',
      message: data.message || `Scheduled maintenance on ${data.date || 'upcoming date'}. App may be unavailable.`,
      icon: 'tools',
      color: 'orange',
      action: null,
    },
    [NOTIFICATION_TYPES.NEW_FEATURE_AVAILABLE]: {
      title: '✨ New Feature!',
      message: data.message || 'Check out the latest feature we just added!',
      icon: 'sparkles',
      color: 'violet',
      action: data.action || null,
    },

    // ══════════════════════════════════════════════════════════════
    // APPROVALS & MODERATION
    // ══════════════════════════════════════════════════════════════
    [NOTIFICATION_TYPES.CLINIC_APPROVED]: {
      title: 'Clinic Approved! ✅',
      message: `Your clinic "${data.clinicName || 'listing'}" has been approved and is now live`,
      icon: 'check-circle',
      color: 'green',
      action: `/massage-clinics/${data.clinicId}`,
    },
    [NOTIFICATION_TYPES.CLINIC_REJECTED]: {
      title: 'Clinic Not Approved',
      message: `Your clinic "${data.clinicName || 'listing'}" needs changes. ${data.reason || 'Check your email for details.'}`,
      icon: 'x-circle',
      color: 'red',
      action: `/massage-clinics/${data.clinicId}/edit`,
    },
    [NOTIFICATION_TYPES.CLINIC_PENDING]: {
      title: 'Clinic Under Review',
      message: `Your clinic "${data.clinicName || 'listing'}" is being reviewed. We'll notify you once approved.`,
      icon: 'clock',
      color: 'yellow',
      action: `/massage-clinics/${data.clinicId}`,
    },
    [NOTIFICATION_TYPES.CLINIC_SUSPENDED]: {
      title: 'Clinic Suspended',
      message: `Your clinic "${data.clinicName || 'listing'}" has been suspended. ${data.reason || 'Contact support for details.'}`,
      icon: 'ban',
      color: 'red',
      action: '/support',
    },
    [NOTIFICATION_TYPES.PROFILE_VERIFIED]: {
      title: 'Profile Verified! 🎉',
      message: 'Your profile has been verified. You now have a verified badge!',
      icon: 'badge-check',
      color: 'blue',
      action: '/profile',
    },
    [NOTIFICATION_TYPES.PROFILE_VERIFICATION_REJECTED]: {
      title: 'Verification Not Approved',
      message: data.reason || 'Your verification request wasn\'t approved. Please try again with clearer photos.',
      icon: 'x-circle',
      color: 'red',
      action: '/profile/verify',
    },
    [NOTIFICATION_TYPES.CONTENT_FLAGGED]: {
      title: '⚠️ Content Flagged',
      message: data.message || 'Some of your content has been flagged and is under review.',
      icon: 'flag',
      color: 'orange',
      action: data.action || null,
    },
    [NOTIFICATION_TYPES.CONTENT_REMOVED]: {
      title: 'Content Removed',
      message: data.message || 'Some of your content violated our guidelines and has been removed.',
      icon: 'trash',
      color: 'red',
      action: '/community-guidelines',
    },
    [NOTIFICATION_TYPES.ACCOUNT_WARNING]: {
      title: '⚠️ Account Warning',
      message: data.message || 'Your account has received a warning. Please review our community guidelines.',
      icon: 'alert',
      color: 'orange',
      action: '/community-guidelines',
    },
    [NOTIFICATION_TYPES.ACCOUNT_SUSPENDED]: {
      title: '🚫 Account Suspended',
      message: data.message || 'Your account has been suspended. Contact support for more information.',
      icon: 'ban',
      color: 'red',
      action: '/support',
    },
  };

  return templates[type] || {
    title: 'Notification',
    message: data.message || 'You have a new notification',
    icon: 'bell',
    color: 'gray',
    action: null,
  };
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Group notifications by date
 */
export function groupNotificationsByDate(notifications) {
  const groups = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  notifications.forEach(notif => {
    const date = new Date(notif.created_at);
    if (date >= today) {
      groups.today.push(notif);
    } else if (date >= yesterday) {
      groups.yesterday.push(notif);
    } else if (date >= weekAgo) {
      groups.thisWeek.push(notif);
    } else {
      groups.older.push(notif);
    }
  });

  return groups;
}