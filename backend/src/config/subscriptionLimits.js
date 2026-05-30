// Subscription plan limits. Billing is NOT implemented — only this data model
// and the placeholder enforcement in aiCache / the cache routes use it. When
// billing is added, only users.subscription_plan needs to be set.
const PLAN_LIMITS = {
  free: {
    ai_refreshes_per_month: 5,
    cache_ttl_multiplier: 1.0, // standard TTL
    can_refresh_ride_analysis: false,
    can_refresh_periodization: false,
  },
  basic: {
    ai_refreshes_per_month: 20,
    cache_ttl_multiplier: 0.5, // cache expires 2x faster (fresher data)
    can_refresh_ride_analysis: true,
    can_refresh_periodization: false,
  },
  pro: {
    ai_refreshes_per_month: 999, // effectively unlimited
    cache_ttl_multiplier: 0.25, // cache expires 4x faster
    can_refresh_ride_analysis: true,
    can_refresh_periodization: true,
  },
};

module.exports = { PLAN_LIMITS };
