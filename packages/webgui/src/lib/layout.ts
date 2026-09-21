/**
 * Layout breakpoint constants.
 *
 * CSS custom properties cannot be used inside @media queries,
 * so we export the raw numbers here and use literal px values
 * in media queries with a comment naming the token.
 */

/** Sidebar appears (--bp-md) */
export const BP_MD = 720;

/** Inspector appears (--bp-lg) */
export const BP_LG = 1100;
