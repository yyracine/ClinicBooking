import { describe, it, expect } from "vitest";

// Helper function to determine which channels to send
function getActiveChannels(
  emailConsent: boolean | undefined,
  smsConsent: boolean | undefined,
  inAppConsent: boolean | undefined
): { email: boolean; sms: boolean; inApp: boolean } {
  const email = emailConsent === true;
  const sms = smsConsent === true;
  const inApp = inAppConsent === true || (!email && !sms);
  return { email, sms, inApp };
}

describe("Consent logic", () => {
  it("sends to all channels if all consents are true", () => {
    const channels = getActiveChannels(true, true, true);
    expect(channels).toEqual({ email: true, sms: true, inApp: true });
  });

  it("sends only to email if only email consented", () => {
    const channels = getActiveChannels(true, false, false);
    expect(channels).toEqual({ email: true, sms: false, inApp: false });
  });

  it("sends only to SMS if only SMS consented", () => {
    const channels = getActiveChannels(false, true, false);
    expect(channels).toEqual({ email: false, sms: true, inApp: false });
  });

  it("sends only to in-app if only in-app consented", () => {
    const channels = getActiveChannels(false, false, true);
    expect(channels).toEqual({ email: false, sms: false, inApp: true });
  });

  it("defaults to in-app if no channels consented", () => {
    const channels = getActiveChannels(false, false, false);
    expect(channels).toEqual({ email: false, sms: false, inApp: true });
  });

  it("defaults to in-app if undefined (backward compat)", () => {
    const channels = getActiveChannels(undefined, undefined, undefined);
    expect(channels).toEqual({ email: false, sms: false, inApp: true });
  });

  it("treats undefined as false (backward compat) with email+SMS", () => {
    const channels = getActiveChannels(undefined, true, undefined);
    expect(channels).toEqual({ email: false, sms: true, inApp: false });
  });

  it("disables in-app fallback if email or SMS consented", () => {
    const channels = getActiveChannels(true, false, false);
    expect(channels.inApp).toBe(false);
  });

  it("enables in-app fallback only if both email and SMS are false", () => {
    const channels = getActiveChannels(false, false, false);
    expect(channels.inApp).toBe(true);
  });

  it("respects email + SMS mix without in-app", () => {
    const channels = getActiveChannels(true, true, false);
    expect(channels).toEqual({ email: true, sms: true, inApp: false });
  });

  it("respects email + in-app without SMS", () => {
    const channels = getActiveChannels(true, false, true);
    expect(channels).toEqual({ email: true, sms: false, inApp: true });
  });
});
